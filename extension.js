
function activate(context) {
    "use strict";

    var vscode  = require('vscode'),
        builder = require('./libs/NicePageBuilder.js'),
        izFS    = require('./libs/izFS.js'),
        com     = vscode.commands.registerCommand('extension.nicePageBuilder',
/* settings.json  
{
    "nicePageBuilder.tasks" : [{
            "htmlRoot" : { "path" : "src", "exclude" : "" },
            "jsonList" : [
                { "path" : "src/jsons/list.json", "name" : "list" }, {} ...
            ],
            "output"   : "out"
    }]
} */
    function(){
        var ws     = vscode.workspace,
            fs     = new izFS( ws.rootPath ),
            config = ws.getConfiguration('nicePageBuilder'),
            tasks, currentTask, currentTarget, total, progress = 0, iterator, imports,
            created = 0, skiped = 0;

        if( !ws.rootPath ){
            vscode.window.showErrorMessage('Use of mainFile requires a folder to be opened');
            return;
        };

        if( !config.tasks ){
            vscode.window.showErrorMessage('(T-T) Not fonund "nicePageBuilder.tasks" at settings.json.');
            return;
        };

        try {
            tasks = JSON.parse(JSON.stringify(config.tasks)); // deep copy
            total = tasks.length;
        } catch(o_O){
            vscode.window.showErrorMessage( '(T-T) ' + o_O );
            return;
        };

        ws.saveAll();
        startTask();

        // 1. Start Task, find .htm(l) files
        function startTask(){
            builder.reset();

            if( progress < total ){
                currentTask = tasks.shift();
                if( currentTarget = currentTask.htmlRoot ){
                    ++progress;
                    fs.find({
                        rootPath : currentTarget.rootPath,
                        include  : currentTarget.include || createPath( currentTarget.rootPath, '**/*.htm*' ),
                        exclude  : currentTarget.exclude,
                        getText  : true
                        }, findFileDispatcher );
                } else {
                    vscode.window.showErrorMessage( '(T-T) Not fonund "htmlRoot"!' );
                };
            } else {
                vscode.window.setStatusBarMessage( '[' + progress + '/' + total + '] (^-^) All Tasks complete!' );
            };
        };

        function findFileDispatcher( ite ){
            switch( ite.type ){
                case 'findFileSuccess' :
                case 'readFileSuccess' :
                    var res = builder.readHTML(
                        '/' + ite.path.substr( createPath( currentTarget.rootPath, '' ).length ),
                        ite.data, ite.stats.birthtime.getTime(), ite.stats.mtime.getTime() );

                    vscode.window.setStatusBarMessage( '[' + progress + '/' + total + '] read HTML [' + ite.index + '/' + ite.length + ']' );
                    
                    if( res && res.importFiles && res.importFiles.length ){// array.<URLString>
                        if( !imports ){
                            imports  = [];
                            iterator = ite;
                        };
                        while( res.importFiles.length ) imports.push( res.importFiles.shift() );
                    };

                    if( imports ){
                        importFiles();
                    } else {
                        ite.next();
                    };
                    break;
                case 'findFileError' :
                case 'readFileError' :
                    vscode.window.showErrorMessage( '(T-T) ' + ite.error );
                    ( iterator || ite ).kill();
                    break;
                case 'findFileComplete' :
                    startJsonTask();
                    break;
            };
        };

        function importFiles(){
            if( imports.length ){
                fs.read({
                    path    : createPath( currentTarget.rootPath, imports.shift() ),
                    getText : true
                    }, findFileDispatcher );
            } else {
                iterator.next();
                imports = iterator = null;
            };
        };

        function startJsonTask(){
            currentTarget = currentTask.jsonList && currentTask.jsonList.shift();

            if( currentTarget ){
                fs.read({
                    path    : currentTarget.path,
                    getText : true
                    }, findJsonDispatcher );
            } else {
                build();
            };
        };

        function findJsonDispatcher( ite ){
            switch( ite.type ){
                case 'readFileSuccess' :
                    builder.readJSON( currentTarget.name, ite.data );
                    startJsonTask();
                    break;
                case 'readFileError' :
                    vscode.window.showErrorMessage( '(T-T) ' + ite.error );
                    break;
            };
        };

        // 4. build .html file
        function build(){
            try {
                var currentBuild = builder.build();
            } catch(o_O){
                vscode.window.showErrorMessage( '(T-T) ' + o_O );
                return;
            };

            if( currentBuild ){
                vscode.window.setStatusBarMessage( '[' + progress + '/' + total + '] write [' + created + '] skiped [' + skiped + ']' );
                fs.write({
                    path       : createPath( currentTask.output, currentBuild.path ),
                    string     : currentBuild.html,
                    writeIfOld : currentBuild.updatedAt
                }, writeFileDispatcher );
            } else {
                vscode.window.setStatusBarMessage( '[' + progress + '/' + total + '] (^-^) Task complete!' );
                startTask();
            };
        };

        function writeFileDispatcher( e ){
            switch( e.type ){
                case 'writeFileSuccess' :
                    ++created;
                    if( e.skiped ) ++skiped;
                    build();
                    break;
                case 'writeFileError' :
                    vscode.window.showErrorMessage( '(T-T) ' + e.error );
                    break;
            };
        };

        function createPath( a, b ){
            if( a.charAt( a.length - 1 ) === '/' ) a = a.substr( 0, a.length - 1 );
            if( b.charAt( 0 ) === '/' ) b = b.substr( 1 );
            return a + '/' + b;
        };
    });

    context.subscriptions.push( com );
};
exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() {}

exports.deactivate = deactivate;