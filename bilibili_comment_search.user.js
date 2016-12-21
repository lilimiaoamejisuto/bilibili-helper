// ==UserScript==
// @name         Bilibili评论定位
// @namespace    http://tampermonkey.net/
// @version      0.8
// @description  点击消息中心的评论后, 自动定位评论; (Update: 修复番剧页面跳转问题: 通过监听消息页面的点击事件获取真实原来的url, 需要等到消息页面载入完成后才有效;)
// @author       ipcjs
// @include      http://*.bilibili.com/*?*aid=*
// @include      http://bangumi.bilibili.com/anime/*/play
// @include      http://message.bilibili.com/
// @exclude      http://www.bilibili.com/html/html5player.html*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        unsafeWindow
// ==/UserScript==

(function () {
    'use strict';
    function msgClickListener() {
        var group;
        if (group = this.href.match(/^http:\/\/bangumi\.bilibili\.com\/anime\/v\/(\d+)\?aid=(\d+)#reply(\d+)$/)) {
            GM_setValue('bangumi_id=' + group[1], this.href); // 点击番剧页面的链接时存储真实的url
            console.log('click', this.href);
        }
    }

    function listenMsgClick() {
        var a = $('#message_right ul > li > .message-main-right')
            .find('> .message-content-title > a , > div > span.message-context > a')
            .off('click', msgClickListener) // 先移除, 在监听
            .click(msgClickListener);
        console.log('listen click:', a.length, a);
    }

    function listenDomChange() {
        console.log('listen DOM change.', 'readyState:', unsafeWindow.document.readyState);
        new unsafeWindow.MutationObserver(function (mutations, observer) {
            // console.log(...mutations);
            mutations.forEach(function (item, index) {
                if (item.type === 'childList'
                    && item.target.nodeName === 'UL' && item.target.className === 'message-main-lists' // target为ul.message-main-lists
                    && item.addedNodes.length > 10 // 添加消息列表的事件中, 添加的node数量一般为41
                ) {
                    // console.log(item, index);
                    listenMsgClick();
                }
            });
        }).observe(unsafeWindow.document.querySelector('#message_center_box'), {
            childList: true,
            subtree: true,
            // attributes: true
        });
    }


    function jumpToComment() {
        if (unsafeWindow.location.host === 'message.bilibili.com' && unsafeWindow.location.pathname === '/') {
            listenMsgClick();
            listenDomChange();
        }

        var id, type, feedback, group, valueName, temp,
            title = '[' + GM_info.script.name + ']',
            realUrl = unsafeWindow.location.href;
        if (group = realUrl.match(/\/anime\/\d+\/play#(\d+)/)) { // 若为番剧页面
            valueName = 'bangumi_id=' + group[1];
            if (temp = GM_getValue(valueName)) { // 读取存储的真实url
                realUrl = temp;
                GM_deleteValue(valueName); // 读取成功后删除这个值
                console.log('readUrl:', realUrl, 'GM_listValues', GM_listValues());
            }
        }

        if (unsafeWindow.aid) {
            id = unsafeWindow.aid;
            type = "arc";
        } else if (unsafeWindow.tp_id) {
            id = unsafeWindow.tp_id;
            type = "topic";
        } else if (group = realUrl.match(/aid=(\d+)/)) {
            // 试图从url中提取id
            id = group[1];
            type = 'arc';
        }
        if (id && unsafeWindow.bbFeedback) {
            console.log(title, 'search...');
            $('#comment .comm').children().remove(); // 移除评论区域..., 让bbFeedback重新生成
            feedback = new unsafeWindow.bbFeedback(".comm", type, {autoLoad: true});
            $("#load_comment").off("click").removeAttr("onclick").on("click", function () {
                feedback.show(id, 1)
            });
            var replyId,
                callback = function (context) {
                    var replyElement = $("#l_id_" + replyId, context);
                    if (replyElement.length !== 0) {
                        setTimeout(function () {
                            $(document).scrollTop(replyElement.offset().top - 20)
                        }, 0);
                        if (replyElement.parents(".reply").length) {
                            $(".re_ta", replyElement).click();
                        } else {
                            $(".huifu", replyElement).click()
                        }
                    }
                };
            if (group = realUrl.match(/#fb,([0-9]+),([0-9]+),([0-9]+),(.+)$/)) {
                replyId = group[3];
                feedback.show(id, 1, replyId, callback);
            } else if (group = realUrl.match(/#reply([0-9]+)$/)) {
                replyId = group[1];
                feedback.show(id, 1, replyId, callback);
            } else {
                feedback.show(id, 1);
            }
        } else {
            console.log(title, '当前页不可定位:', unsafeWindow.location.href);
        }
    }

    if (unsafeWindow.document.readyState === 'complete') {
        jumpToComment();
    } else {
        $(unsafeWindow).load(jumpToComment); // 页面完全加载完成后在再触发
    }
})();