
function activate(context) {
    var MAX_TARGET_FILES = 1000, // https://github.com/Microsoft/vscode/issues/697

        vscode  = require('vscode'),
        fs      = require('fs'),
        http    = require('http'),
        builder = require('./libs/NicePageBuilder.js'),
        com     = vscode.commands.registerCommand('extension.nicePageBuilder',
/* settings.json  
{
    "nicePageBuilder.tasks" : [{
            "htmlRoot" : { "path" : "src", "exclude" : "" },
            "jsonList" : [
                { "path" : "src/jsons/list.json", "name" : "list" },
                { "path" : "http://hoge.jp/fuga.json", "name" : "hoge" }
            ],
            "output"   : "out"
    }]
} */
    function(){
        var ws         = vscode.workspace,
            wsRootPath = ws.rootPath,
            config     = ws.getConfiguration('nicePageBuilder'),
            tasks, currentTask, currentTarget,
            outpotFolderPath, targetFiles, targetFileUri, currentStatus, currentBuild,
            jsonData, total, progress;

        if( !wsRootPath ){
            vscode.window.showErrorMessage('Use of mainFile requires a folder to be opened');
            return;
        };

        if( !config.tasks ){
            vscode.window.showErrorMessage('(T-T) Not fonund "nicePageBuilder.tasks" at settings.json.');
            return;
        };

        try {
            tasks = JSON.parse(JSON.stringify(config.tasks)); // deep copy
        } catch(o_O){
            vscode.window.showErrorMessage( '(T-T) ' + o_O + ' ...' );
            return;
        };

        wsRootPath = wsRootPath.charAt( wsRootPath.length - 1 ) === '\\' ? wsRootPath.substr( 0, wsRootPath.length - 1 ) : wsRootPath;
        ws.saveAll();
        startTask();

        // 1. Start Task, find .htm(l) files
        function startTask(){
            builder.reset();

            if( tasks.length ){
                currentTask = tasks.shift();
                if( currentTarget = currentTask.htmlRoot ){
                    outpotFolderPath = currentTask.output.split( '/' ).join( '\\' );
                    ws.findFiles(
                        createPath( currentTarget.path, '**/*.htm*' ),
                        currentTarget.exclude, MAX_TARGET_FILES ).then( onFilesFound );
                } else {
                    vscode.window.setStatusBarMessage( '(T-T) Not fonund "htmlRoot"!' );
                };
                return;
            } else {
                vscode.window.setStatusBarMessage( '(^-^) All Tasks complete!' );
            };
        };

        function onFilesFound( files ){
            if( total = files.length ){
                files.sort();
                progress    = -1;
                targetFiles = files;
                readFiles();
            } else {
                vscode.window.setStatusBarMessage( '(T-T) Files at "' + currentTarget.path + '" was not found.' );
                return;
            };
        };
        
        // 2. Read .htm(l) files
        function readFiles(){
            if( targetFileUri = targetFiles.shift() ){
                vscode.window.setStatusBarMessage( '[' + currentTarget.path + ']' + ( ++progress ) + '/' + total + ':reading' );
                fs.stat( createPath( wsRootPath, ws.asRelativePath( targetFileUri ), '\\' ), onGotFileStatus );
            } else {
               vscode.window.setStatusBarMessage( 'Read html complete.' );

               readJson();
            };
        };

        function onGotFileStatus( err, status ){
            if( status ){
                currentStatus = status;
                ws.openTextDocument( targetFileUri ).then( onFileOpened );
            } else {
                vscode.window.setStatusBarMessage( '(T-T) ' + err );
            };
        };

        function onFileOpened(d){
            console.log( '>> ' + ws.asRelativePath( targetFileUri ).split( '\\' ).join( '/' ).substr( currentTarget.path.length ) );
            try {
                var res = builder.readHTML(
                            ws.asRelativePath( targetFileUri ).split( '\\' ).join( '/' ).substr( currentTarget.path.length ),
                            d.getText(), currentStatus.birthtime.getTime(), currentStatus.mtime.getTime() );
                if( res && res.importFiles ){ // array.<URLString>
                    while( res.importFiles.length ){
                        targetFiles.push( createPath( wsRootPath + '\\' + currentTarget.path, res.importFiles.shift(), '\\' ) );
                    };
                };
                readFiles();
            } catch(o_O){
                vscode.window.showErrorMessage( '(T-T) ' + o_O + ' ...' );
            };
        };

        // 3. Read JSON files
        function readJson(){
            if( currentTarget = currentTask.jsonList && currentTask.jsonList.shift() ){
                if( 'http:/ https:'.indexOf( currentTarget.path.substr( 0, 6 ) ) !== -1 ){
                    http.get( onGetRequestSuccess ).on( 'error', onGetRequestError );
                } else {
                    ws.openTextDocument( createPath( wsRootPath, currentTarget.path, '\\' ) ).then( onJsonOpened, onJsonRejected );
                };
            } else {
                build();
            };
        };

            function onGetRequestSuccess( res ){
                currentTarget.body = '';
                res.setEncoding( currentTarget.encode || 'utf8' );
                res.on('data', onRequestData );
                res.on('end' , onRequestEnd );
            };
            function onRequestData( chunk ){ currentTarget.body += chunk; };
            function onRequestEnd( res ){
                builder.readJSON( currentTarget.name, currentTarget.body );
                readJson();
            };
            function onGetRequestError( e ){
                vscode.window.showErrorMessage( '(T-T) ' + e.message );
            };

        function onJsonOpened(d){
            try {
                builder.readJSON( currentTarget.name, d.getText() );
                readJson();
            } catch(o_O){
                vscode.window.setStatusBarMessage( '(T-T) ' + o_O + ' ...' );
            };
        };

        function onJsonRejected( reson ){
            vscode.window.showErrorMessage( '(T-T) ' + reson + ' ...' );
        };

        // 4. build .html file
        function build(){
            var folderPath = wsRootPath,
                paths, path;
console.log( 'build...' )
            try {
                currentBuild = builder.build();
            } catch(o_O){
                vscode.window.setStatusBarMessage( '(T-T) ' + o_O + ' ...' );
                return;
            };

            if( currentBuild ){
                console.log( currentBuild.path )
                path = currentBuild.path.split( '/' );
                --path.length;
                paths = ( outpotFolderPath + path.join( '/' ) ).split( '/' ).join( '\\' ).split( '\\' );

                vscode.window.setStatusBarMessage( '[build]' + ( ++progress ) + '/' + total + ':[]' );

                while( paths.length ){
                    path = paths.shift();
                    if( !path || path === '.' ){
                        path = paths.shift();
                    };
                    folderPath += '\\' + path;
                    try {
                        // http://stackoverflow.com/questions/13696148/node-js-create-folder-or-use-existing
                        // If you want a quick-and-dirty one liner, use this:
                        fs.existsSync( folderPath ) || fs.mkdirSync( folderPath );
                    } catch(e){
                        vscode.window.showErrorMessage('(T-T). Failed to create folder [' + outpotFolderPath + ']' );
                        return;
                    };
                };

                fs.open( wsRootPath + '\\' + createPath( outpotFolderPath, currentBuild.path, '\\' ), 'w', onFileCreated );
            } else {
                vscode.window.setStatusBarMessage( '(^-^) Task complete!' );
                startTask();
            };
        };

        function onFileCreated(err, fd){
            var buffer;

            if( 0 <= fd ){
                buffer = new Buffer( currentBuild.html );
                fs.writeSync( fd, buffer, 0, buffer.length );
                fs.close(fd);
                build();
            } else {
                vscode.window.setStatusBarMessage( '(T-T).. ' + err );
            };
        };

        // utility
        function createPath( root, path, opt_separator ){
            var i = root.length - 1;

            if( 0 <= i ){
                root += root.charAt( i ) === '/' ? '' : '/';
            } else {
                root = '';
            };
            if( path.charAt( 0 ) === '/' ) path = path.substr( 1 );
            return ( root + path ).split( '/' ).join( opt_separator || '/' );
        };
    });

    context.subscriptions.push( com );
};
exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() {}

exports.deactivate = deactivate;