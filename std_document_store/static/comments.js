
(function($) {

    $(document).ready(function() {

        // Configuration
        var configDiv = $('#z__docstore_comments_configuration')[0],
            displayedVersion = configDiv.getAttribute('data-displayedversion')*1,
            viewingComments = !!configDiv.getAttribute('data-view'),
            canAddComment = !!configDiv.getAttribute('data-add'),
            commentServerUrl = configDiv.getAttribute('data-url');

        // ------------------------------------------------------------------

        var userNameLookup = {};

        var displayComment = function(formId, uname, comment) {
            var element = $('#'+formId+' div[data-uname='+uname+']');
            var div = $('<div class="z__docstore_comment_container"></div>');
            div.append($('<div></div>', {
                "class": "z__docstore_comment_header",
                text: (userNameLookup[comment.uid]||'') + ' @ ' + comment.datetime
            }));
            _.each(comment.comment.split(/[\r\n]+/), function(p) {
                p = $.trim(p);
                if(p) { div.append($("<p></p>", {text:p})); }
            });
            var versionMsg;
            if(comment.version < displayedVersion) {
                div.addClass("z__docstore_comment_previous_version");
                versionMsg = 'This comment refers to a previous version of this form.';
            } else if(comment.version > displayedVersion) {
                div.addClass("z__docstore_comment_later_version");
                versionMsg = 'This comment refers to a later version of this form.';
            }
            if(versionMsg) {
                div.append($('<div></div>', {
                    "class": "z__docstore_comment_different_version_msg",
                    text: versionMsg
                }));
            }
            element.append(div);
        };

        // ------------------------------------------------------------------

        // Viewing comments?
        if(viewingComments) {
            $.ajax(commentServerUrl, {
                dataType: "json",
                success: function(data) {
                    if(data.result !== "success") {
                        window.alert("Failed to load comments");
                        return;
                    }
                    userNameLookup = data.users || {};
                    _.each(data.forms, function(elements, formId) {
                        _.each(elements, function(comments, uname) {
                            _.each(comments, function(comment) {
                                displayComment(formId, uname, comment);
                            });
                        });
                    });
                }
            });
        }

        // ------------------------------------------------------------------

        // Adding comments
        if(canAddComment) {
            $('#z__docstore_body div[data-uname]').each(function() {
                // Ignore if this contains other elements with unames
                if($('div[data-uname]',this).length) { return; }
                $(this).prepend('<div class="z__docstore_add_comment"><a class="z__docstore_add_comment_button" href="#">Add comment</a></div>');
            });
            $('#z__docstore_body').on('click', '.z__docstore_add_comment_button', function(evt) {
                evt.preventDefault();
                var comment = window.prompt("Add comment to form --- TODO: replace with better UI");
                if(comment) {
                    var element = $(this),
                        formId = element.parents('.z__docstore_form_display').first()[0].id,
                        uname = element.parents('[data-uname]').first()[0].getAttribute('data-uname');
                    $.ajax(commentServerUrl, {
                        method: "POST",
                        data: {
                            __: $('#z__docstore_comments_configuration input[name=__]')[0].value,   // CSRF token
                            version: displayedVersion,
                            form: formId,
                            uname: uname,
                            comment: comment
                        },
                        dataType: "json",
                        success: function(data) {
                            if(data.result !== "success") {
                                window.alert("Failed to add comment");
                                return;
                            }
                            userNameLookup[data.comment.uid] = data.commentUserName;
                            displayComment(formId, uname, data.comment);
                        }
                    });
                }
            });
        }

    });

})(jQuery);
