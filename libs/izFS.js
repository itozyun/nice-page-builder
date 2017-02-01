// if the module has no dependencies, the above pattern can be simplified to
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define(['fs','minimatch','path'], factory);
  } else if (typeof exports === 'object') {
    // commonjs
    module.exports = factory();
  } else {
    // Browser globals
    root[ 'izFS' ] = factory;
  };
})(this, function (fs, minimatch, path) {

"use strict";

if (typeof define === 'function' && define.amd) {
    // AMD
} else if (typeof exports === 'object') {
    // commonjs
    fs        = require( 'fs' );
    path      = require( 'path' );
    minimatch = require( 'minimatch' );
} else {
    // Browser globals
    fs        = this.fs;
    path      = this.path;
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
        currentPath     = options.rootPath || '',
        index           = -1,
        targetFile, killed;

    fs.readdir( context.createPath( currentPath ), onReadDir );

    function onReadDir( err, list ){
        var p;

        if( !killed ){
            if( err ){
                error( err );
            } else {
                while( p = list.shift() ) filesAndFolders.push( path.join( currentPath, p ) );
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
        if( killed ) return;

        switch( e.type ){
            case 'readFileSuccess' :
                if( e.stats.isDirectory() ){
                    if( !options.exclude || !minimatch( e.path, options.exclude ) ){
                        fs.readdir( context.createPath( e.path ), onReadDir );
                    } else {
                        next();
                    };
                } else if( minimatch( e.path, options.include ) &&
                    ( !options.exclude || !minimatch( e.path, options.exclude ) )
                ){
                    var obj = {
                        type   : 'findFileSuccess',
                        path   : convertSeparator( e.path ),
                        stats  : e.stats,
                        index  : index,
                        length : filesAndFolders.length,
                        next   : next, kill : kill
                    };
                    if( options.getText ) obj.data = e.data;
                    callback( obj );
                } else {
                    next();
                };
                break;
            case 'readFileError' :
                error( e.error );
                break;
        };
    };

/**
 * 
 */
    function error( err ){
        callback( { type : 'findFileError', error : err, next : next, kill : kill } );
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

// TODO require('path')
function createPath( p ){
    // fix for path.isAbsolute( 'R:' ) -> false.
    if( p.split( '' ).pop() === ':' ) return path.normalize( p );
    if( path.isAbsolute( p ) ) return path.normalize( p );
    return path.join( this._rootPath, p );
};

function read( options, callback ){
    var context = this,
        p       = options.path,
        getText = options.getText,
        targetFile;

    fs.stat( context.createPath( p ), onStat );

    function onStat( err, stats ){
        if( err ){
            callback( { type : 'readFileError', error : err } );
            reset();
        } else {
            targetFile = { path : p, stats : stats };
            if( stats.isDirectory() ){
                onReadFileSuccess();
            } else
            if( getText ){
                fs.readFile( context.createPath( p ), 'utf8', onReadFile );
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
            path   : convertSeparator( targetFile.path ),
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


function write( options, callback ){
    var p              = options.path,
        bufferOrString = options.string || options.buffer,
        writeIfOld     = options.writeIfOld,
        context        = this,
        pathElements, targetFolderDepth, existFolderDepth, openFileID;

/** File の存在確認 */
    fs.exists( context.createPath( p ), onExist );

    function onExist( exist ){
        if( exist ){
            typeof writeIfOld === 'number' ? context.read( { path : p }, onFileReadDispatcher ) : createFile();
        } else {
            pathElements = path.dirname( p ).split( '/' );//path.sep );
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

/** File の作られた日時の確認 */
    function onFileReadDispatcher( e ){
        switch( e.type ){
            case 'readFileSuccess' :
                if( e.stats.mtime.getTime() < writeIfOld ){
                    createFile();
                } else {
                    callback( { type : 'writeFileSuccess', skiped : true } );
                    reset();
                };
                break;
            case 'readFileError' :
                error( e.error );
                break;
        };
    };
    

/** File の存在確認 */
    function createFile(){
        fs.open( context.createPath( p ), 'w', onFileCreate );
    };

    function onFileCreate( err, fd ){
        if( err ){
            error( err );
        } else {
            openFileID = fd;
            if( typeof bufferOrString === 'string' ){
                fs.write( fd, bufferOrString, 0, 'utf8', onWrite );
            } else {
                fs.write( fd, bufferOrString, 0, bufferOrString.length, onWrite );
            };
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

function convertSeparator( p ){
    return p.split( '\\' ).join( '/' );
};

return izFS;
});