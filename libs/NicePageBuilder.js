// if the module has no dependencies, the above pattern can be simplified to
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define([], factory);
  } else if (typeof exports === 'object') {
    // commonjs
    module.exports = factory();
  } else {
    // Browser globals
    root[ 'nicePageBuilder' ] = factory;
  }
})(this, function(){

"use strict";

var pages, externalJs, templetes, mixins, jsons, finished, extraPages,
    onBeforeBuildFunctions,
    buildStarted, skipResisterAsPage, createdByUserScript,
    Page, createPageClassNow;

// 継承して使う
function PageBase( path, createTime, updatedTime ){
  if( createPageClassNow ) return;

  var ary = path.split('/');

  this.FILE_PATH   = path;
  this.FILE_NAME   = ary.pop();
  this.FOLDER_PATH = ary.join('/');
  this.URL         = this.FILE_NAME === 'index.html' ? this.FOLDER_PATH + '/' : path;
  this.CREATED_AT  = createTime   || (new Date).getTime();
  this.MODIFIED_AT = updatedTime  || (new Date).getTime();
  this.UPDATED_AT  = updatedTime  || (new Date).getTime();

  if( skipResisterAsPage ){
    skipResisterAsPage = false;
    templetes[ path ] = this;
    if( pages[ path ] ) delete pages[ path ];
  } else if( createdByUserScript ){
    if( extraPages[ path ] ) throw '' + path + ' already exist at extraPages!';
    if( pages[ path ] ) throw '' + path + ' already exist at pages!';
    extraPages[ path ] = this;
  } else {
    if( pages[ path ] ) throw '' + path + ' already exist!';
    pages[ path ] = this;
  };
};

PageBase.prototype.toRelativePath = function( path ){
  return toRelativePath( path, this.FOLDER_PATH );
};

PageBase.prototype.getPage = function( path ){
  path = toProjectRootRelativePath( path, this.FOLDER_PATH );
  
  if( path.charAt( path.length - 1 ) === '/' ){
    return pages[ path + 'index.html' ];
  };
  return pages[ path ];
};

PageBase.prototype.getJSON = function( name ){
  return jsons[ name ];
};

reset();

/************************************************************
 * 0. reset
 * 
 */
function reset(){
  externalJs = {};
  templetes  = {};
  pages      = {};
  extraPages = {};
  mixins     = {};
  jsons      = {};
  finished   = {};
  onBeforeBuildFunctions = [];
  buildStarted = false;

  Page = function(){ PageBase.apply(this, arguments); };

  createPageClassNow = true;
  Page.prototype = new PageBase;
  createPageClassNow = false;

  Page.prototype.constructor = Page;
};

/************************************************************
 * 1. include HTML/JSON を攫って記憶
 * readHTML ret 
 * readJSON
 * 
 */
function readHTML(path, htmlString, createTime, updatedTime ){
  var mixin, ary, page, ret = [], i = -1, bbf;

  if( externalJs[ path ] ){
    externalJs[ path ] = htmlString;
    for( ; bbf = onBeforeBuildFunctions[ ++i ]; ){
        if( bbf.src === path ){
            bbf.funcitonString = htmlString;
        };
    };
  } else if( mixins[ path ] ){
    mixin = toObjectByEval( htmlString );
    if( typeof mixin === 'object' ){
      mixins[ path ]   = mixin;
      mixin.UPDATED_AT = updatedTime;
    } else {
      throw 'MIXIN:' + path + ' is invalid js!';
    };
    ary = path.split( '/' );
    ary.pop();
    if( path = mixin.TEMPLETE ){
      path = toProjectRootRelativePath( path, ary.join( '/' ) );
      if( pages[ path ] ){
        templetes[ path ] = pages[ path ];
        delete pages[ path ];
      } else if( !templetes[ path ] ){
        templetes[ path ] = true;
        ret.push( path );
      };
    };
  } else {
    if( templetes[ path ] ){
        if( templetes[ path ] !== true ) return;
        skipResisterAsPage = true;
        page = new Page( path, createTime, updatedTime );
    } else if( !pages[ path ] ){
        page = new Page( path, createTime, updatedTime );
    } else {
      return;
    };
 
    // <script type="nice-page-builder/object" for="page-option"></script> の評価
    htmlString = splitString( htmlString, '<script type="nice-page-builder/object" for="page-option">', '</script>', function( code ){
        var obj = toObjectByEval( code ), k;

        for(k in obj) if(!(k in page)) page[k] = obj[k];
        return '';
    } );

    // <script type="nice-page-builder/js" for="beforeBuild"></script> の回収
    htmlString = splitString( htmlString, '<script type="nice-page-builder/js" for="beforeBuild">', '</script>', function( code ){
        onBeforeBuildFunctions.push( { context : page, funcitonString : code } );
        return '';
    } );

    page.CONTENT = htmlString;

    // MIXIN の要求は重複しない
    if( page.MIXINS ){
      for( ; path = page.MIXINS[ ++i ]; ){
        path = toProjectRootRelativePath( path, page.FOLDER_PATH );
        if( !mixins[ path ] ){
          mixins[ path ] = true;
          ret.push( path );
        };
      };
    };
    if( path = page.TEMPLETE ){
      path = toProjectRootRelativePath( path, page.FOLDER_PATH );
      if( pages[ path ] ){
        templetes[ path ] = pages[ path ];
        delete pages[ path ];
      } else if( !templetes[ path ] ){
        templetes[ path ] = true;
        ret.push( path );
      };
    };
  };
  return { importFiles : ret };
};

function readJSON( name, jsonString ){
    var json = toObjectByEval( jsonString );

    if( typeof json === 'object' ){
      jsons[ name ] = json;
    } else {
      throw 'JSON:' + name + ' is exits!';
    };
};

/************************************************************
 * 2. > MIXIN のマージ
 *    > onBeforeBuild が定義されていたらこれを実行
 */
function beforeBuild(){
    var path, obj;

    for( path in pages ){
        mergeMixinsAndTemplete( pages[ path ] );
    };

    createdByUserScript = true;
    while( obj = onBeforeBuildFunctions.shift() ){
      try {
        ( new Function( 'pages, Page, page', obj.funcitonString ) ).call( obj.context, pages, Page, obj.context );
      } catch(o_O){
        throw o_O + '\n' + obj.funcitonString.replace( /\s/g, '' );
      };
    };
    createdByUserScript = false;

    for( path in extraPages ){
        mergeMixinsAndTemplete( extraPages[ path ] );
        pages[ path ] = extraPages[ path ];
    };

    buildStarted = true;
};

function mergeMixinsAndTemplete( page ){
  var i = -1, _mixins, path, mixin, tmpl;

  if( _mixins = page.MIXINS ){
      while( path = _mixins[ ++i ] ){
        path  = toProjectRootRelativePath( path, page.FOLDER_PATH );
        mixin = mixins[ path ];
        mixin && mix( mixin );
      };
  };
  if( path = page.TEMPLETE ){
    path = toProjectRootRelativePath( path, page.FOLDER_PATH );
    if( tmpl = templetes[ path ] ){
      mix( tmpl );
    } else {
      throw 'TEMPLETE:' + tmpl + ' not found!';
    };
  };

  function mix( obj, k ){
      for( k in obj ) if( !( k in page ) ) page[k] = obj[k];
      if( page.UPDATED_AT < obj.UPDATED_AT ) page.UPDATED_AT = obj.UPDATED_AT;
  };
};

/************************************************************
 * 3. 書き出し
 */
function build(){
  var path, page, updated, tmpl, html, last;
  
  if( !buildStarted ) beforeBuild();

  for( path in pages ){
    page = pages[ path ];
    if( page.SKIP || finished[ path ] ) continue;
    html = page.CONTENT;

    // templete の読み込み
    if( tmpl = page.TEMPLETE ){
      if( tmpl = templetes[ tmpl ] ){
        html = tmpl.CONTENT;
      } else {
        throw 'TEMPLETE:' + tmpl + ' not found!';
      };
    };

    if(updated) continue;

    finished[ path ] = true;

    // templete を使用する場合、コンテンツは page.CONTENT に存在する
    // if( tmpl ) page.CONTENT = _execInlineScript( page, page.CONTENT );

    while( html !== last ){ // inlineScript が inlineScript を出力するケースに対応
      last = html;
      html = _execInlineScript( page, html );

      // ($ $) 相対リンクの解決
      html = splitString( html, '($$', '$$)', function( link ){
        // 前後の空白の除去
        while(link.charAt(0) === ' ') link = link.substr(1);
        while(link.charAt(link.length - 1) === ' ') link = link.substr(0,link.length - 1);

        return toRelativePath( link, page.FOLDER_PATH );
      } );
    };

    return { path : path, html : html, updatedAt : page.UPDATED_AT };
  };
};

// inline script の評価
function _execInlineScript(page, str){
  return splitString( str, '{$$', '$$}', function( code ){
    //console.log( code )
      code = code.split( '\n' ).join( '' );
      //console.log( code )
      try {
        return ( new Function( 'page,code', 'return function(){return eval(code)}.call(page)' ) ).call( page, page, code );
      } catch(o_O){
        throw o_O + '\n' + code.replace( /\s/g, '' );
      };
  } );
};

function toObjectByEval( jsonString ){
    try {
      return eval('(' + jsonString + ')');
    } catch(o_O){
      throw o_O + '\n' + jsonString.replace( /\s/g, '' );
    };
};

/************************************************************
 * Utilities
 */
function splitString( str, startStr, endStr, func ){
  var replaces = [], 
      from     = 0,
      start, end, res, ary;

  while(0 <= (start = str.indexOf(startStr, from))){
    end = str.indexOf(endStr, start);
    if(end === -1){
      throw endStr + ' not found!';
    } else {
      res = func( str.substring( start + startStr.length, end ) );
      from = end + endStr.length;
      replaces.push([ start, res, from ]);
    };
  };
  
  while( ary = replaces.pop() ){
    str = str.substr(0, ary[0]) + ary[1] + str.substr(ary[2]);
  };

  return str;
};

/**
 * 相対リンクに変更する
 */
function toRelativePath( targetPath, currentPath ){
  var name, link, i, l, depth, skip;
  
  currentPath = currentPath.split( '/' );
  currentPath[ 0 ] === '' && currentPath.shift();

  if( targetPath.substr(0, 2) === '//' || targetPath.substr(0, 7) === 'http://' || targetPath.substr(0, 8) === 'https://' ){
    link = targetPath;
  } else if( targetPath.charAt(0) === '/' ){ // ルート相対リンク
    targetPath = targetPath.substr(1).split('/');
    name = targetPath.pop();
    for( i = 0, depth = currentPath.length, l = Math.max( targetPath.length, depth ), link = [], skip = false; i < l; ++i ){
      if( skip || targetPath[ i ] !== currentPath[ i ] ){
        if( i < depth ) link.unshift('..');
        if( targetPath[ i ] ) link.push( targetPath[ i ] );
        skip = true;
      };
    };
    link.push(name);
    link = link.join('/');
  } else {
    // 相対リンク
    while( targetPath.substr(0, 3) === '../' ){
      targetPath = targetPath.substr(3);
      --currentPath.length;
    };
    link = ( currentPath.length ? currentPath.join('/') + '/' : '' ) + targetPath;
  };
  return link;
};

/**
 * 相対リンクをプロジェクトルートを基準にするルート相対リンクに変更する
 */
function toProjectRootRelativePath( targetPath, currentPath ){
  if( targetPath.substr(0, 2) === '//' || targetPath.substr(0, 7) === 'http://' || targetPath.substr(0, 8) === 'https://' ){
    // error
  } else if( targetPath.charAt(0) === '/' ){
    return targetPath;
  };
  return '/' + toRelativePath( targetPath, currentPath );
};

return {
  reset    : reset,
  readHTML : readHTML,
  readJSON : readJSON,
  build    : build
};
});