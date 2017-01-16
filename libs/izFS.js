// if the module has no dependencies, the above pattern can be simplified to
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define(['fs','minimatch'], factory);
  } else if (typeof exports === 'object') {
    // commonjs
    module.exports = factory();
  } else {
    // Browser globals
    root[ 'izFS' ] = factory;
  };
})(this, function (fs, minimatch) {

"use strict";

if (typeof define === 'function' && define.amd) {
    // AMD
} else if (typeof exports === 'object') {
    // commonjs
    fs        = require( 'fs' );
    minimatch = require( 'minimatch' );
} else {
    // Browser globals
    fs        = this.fs;
    minimatch = this.minimatch;
};


function izFS( rootPath ){
    this._rootPath = rootPath;
};

izFS.prototype.find  = find;
izFS.prototype.read  = read;
izFS.prototype.write = write;
izFS.prototype.createPath = createPath;

function find( options, callback ){
    var context         = this,
        filesAndFolders = [],
        currentPath     = options.from || '',
        index           = -1,
        targetFile, killed;

    fs.readdir( context.createPath( currentPath ), onReadDir );

    function onReadDir( err, list ){
        var path;

        if( !killed ){
            if( err ){
                error( err );
            } else {
                while( path = list.shift() ) filesAndFolders.push( currentPath + ( currentPath ? '/' : '' ) + path );
                next();
            };
        };
    };

    function next(){
        if( !killed ){
            if( currentPath = filesAndFolders[ ++index ] ){
                context.read( { path : currentPath, getText : options.getText }, openFileDispatcher );
            } else {
                callback( { type : 'findFileComplete' } );
                reset();
            };
        };
    };

    function openFileDispatcher( e ){
        switch( e.type ){
            case 'readFileSuccess' :
                if( e.stats.isDirectory() ){
                    fs.readdir( context.createPath( currentPath ), onReadDir );
                } else if( minimatch( currentPath, options.include ) &&
                    ( !options.exclude || !minimatch( currentPath, options.exclude ) )
                ){
                    var obj = {
                        type   : 'findFileSuccess',
                        path   : currentPath,
                        stats  : e.stats,
                        index  : index,
                        length : filesAndFolders.length,
                        next   : next, kill : kill, push : push
                    };
                    if( options.getText ) obj.data = e.data;
                    !killed && callback( obj );
                } else {
                    next();
                };
                break;
            case 'readFileError' :
                error( e.error );
                break;
        };
    };

    function push( path ){
        filesAndFolders.indexOf( path ) === -1 && filesAndFolders.push( path );
    };

/**
 * 
 */
    function error( err ){
        callback( { type : 'findFileError', error : err, next : next, kill : kill, push : push } );
    };

    function kill(){
        if( !killed ){
            killed = true;
            callback( { type : 'findFileKill' } );
            reset();
        };
    };

    function reset(){
        context = options = callback = filesAndFolders = targetFile = null;
    };
};

function createPath( path ){
    var root = this._rootPath;
    if( root.charAt( root.length - 1 ) === '/' ) root = root.substr( 0, root.length - 1 );
    if( path.charAt( 0 ) === '/' ) path = path.substr( 1 );
    return ( root + '/' + path ).split( '/' ).join( '\\' );
};

function read( options, callback ){
    var context = this, targetFile;

    fs.stat( context.createPath( options.path ), onStat );

    function onStat( err, stats ){
        if( err ){
            callback( { type : 'readFileError', error : err } );
            reset();
        } else {
            targetFile = { path : options.path, stats : stats };
            if( stats.isDirectory() ){
                onReadFileSuccess();
            } else
            if( options.getText ){
                fs.readFile( context.createPath( options.path ), onReadFile );
            } else {
                onReadFileSuccess();
            };
        };
    };

    function onReadFile( err, data ){
        if( err ){
            callback( { type : 'readFileError', error : err } );
            reset();
        } else {
            targetFile.data = data;
            onReadFileSuccess();
        };
    };

    function onReadFileSuccess(){
        var obj = {
            type   : 'readFileSuccess',
            path   : targetFile.path,
            stats  : targetFile.stats
        };
        if( targetFile.data ) obj.data = targetFile.data.toString();
        callback( obj );
        reset();
    };

    function reset(){
        context = options = callback = targetFile = null;
    };
};


function write( path, bufferOrString, callback ){
    var context = this,
        pathElements, targetFolderDepth, existFolderDepth, openFileID;

/** File の存在確認 */
    fs.exists( context.createPath( path ), onExist );

    function onExist( exist ){
        if( exist ){
            createFile();
        } else {
            pathElements = path.split( '/' );
            pathElements.pop();
            targetFolderDepth = existFolderDepth = pathElements.length;
            checkFolderExist();
        };
    };
/** Folder の存在確認 この辺り fsExtra を使えば省略できる模様... */
    function checkFolderExist(){
        fs.exists( createFolderPath( existFolderDepth ), onFolderExist );
    };

    function onFolderExist( exist ){
        if( exist ){
            targetFolderDepth === existFolderDepth ? createFile() : makeDirectory();
        } else {
            --existFolderDepth;
            checkFolderExist();
        };
    };

    function makeDirectory(){
        fs.mkdir( createFolderPath( existFolderDepth + 1 ), onMakeDirectory );
    };

    function onMakeDirectory( err ){
        if( err ){
            error( err );
        } else {
            ++existFolderDepth;
            targetFolderDepth === existFolderDepth ? createFile() : makeDirectory();
        };
    };

    function createFolderPath( depth ){
        var ary = [], i = 0;

        for( ; i < depth; ++i ){
            ary.push( pathElements[ i ] );
        };
        return context.createPath( ary.join( '/' ) );
    };

/** File の存在確認 */
    function createFile(){
        fs.open( context.createPath( path ), 'w', onFileCreate );
    };

    function onFileCreate( err, fd ){
        if( err ){
            error( err );
        } else {
            openFileID = fd;
            fs.write( fd, bufferOrString, 0, bufferOrString.length, onWrite );
        };
    };

    function onWrite( err ){
        if( err ){
            error( err );
        } else {
            fs.close( openFileID, onClose );
        };
    };

    function onClose( err ){
        if( err ){
            error( err );
        } else {
            callback( { type : 'writeFileSuccess' } );
            reset();
        };
    };

    function error( err ){
        callback( { type : 'writeFileError', error : err } );
        reset();
    };

    function reset(){
        context = bufferOrString = callback = null;
    };
};

return izFS;
});