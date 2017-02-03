# Nice Page builder

![](https://4.bp.blogspot.com/-_jS4oD7mDQ8/WJFq8Z7sZ-I/AAAAAAAARP0/SJJHoRWJ37cwdBuO2pvuHQ_rY3GI1nIHQCLcB/s800/NicePageBuilder_package.jpg "")

Static site generator on Visual Studio Code extension.

VS Code エクステンションの静的サイトジェネレータです。

---

## Overview 概要

1. Generate html from template
2. Separate common data shared by multiple pages into external files
3. Site developers can freely add and call functions that return html strings
4. Rewrite pages or add new pages based on aggregation of pages
5. Rewrite pages or add new pages based on JSON files

---

1. テンプレートからhtmlを生成します
2. 複数のページで共有される共通データを外部ファイルに分ける
3. サイト開発者が html 文字列を返す関数を自由に追加して呼ぶことができます
4. ページの集計を元にしてページを書き換えたり新しいページを追加する
5. JSONファイルを元にしてページを書き換えたり新しいページを追加する

## settings.json example
~~~json
{
    "nicePageBuilder.tasks" : [{
            "htmlRoot" : { "rootPath" : "source", "include" : "", "exclude" : "" },
            "jsonList" : [
                { "path" : "jsons/comment.json", "name" : "comment" },
                { "path" : "jsons/tweet.json",   "name" : "tweet"   }
            ],
            "output"   : "R:/output"
    }]
}
~~~

## Links

[Visual Studio Marketplace > Nice Page Builder](https://marketplace.visualstudio.com/items?itemName=itozyun.nice-page-builder)

## For more information
* [Nice Page Builderをブログ書きながらテストしていったよ](http://outcloud.blogspot.jp/2016/12/npb-test.html)
* [Nice Page Builderのマニュアル](http://outcloud.blogspot.jp/2016/12/npb-manual.html)

**Enjoy!**