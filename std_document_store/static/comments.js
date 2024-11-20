/*global Haplo */

// TODO I18N: client side localisation of docstore comments

(function($) {

    $(document).ready(function() {

        // Configuration
        var configDiv = $('#z__docstore_comments_configuration')[0],
            displayedVersion = configDiv.getAttribute('data-displayedversion')*1,
            viewingComments = !!configDiv.getAttribute('data-view'),
            onlyViewingCommentsForForm = configDiv.getAttribute('data-onlyform'),
            canAddComment = !!configDiv.getAttribute('data-add'),
            commentServerUrl = configDiv.getAttribute('data-url'),
            commentFormUrl = configDiv.getAttribute('data-comments-form-url'),
            isViewer = !!configDiv.getAttribute('data-isviewer'),
            filterOn = configDiv.getAttribute('data-filter') === "1",
            showingChanges = configDiv.getAttribute('data-changes') === "1",
            privateCommentsEnabled = configDiv.getAttribute('data-privatecommentsenabled') === "1",
            defaultCommentIsPrivate = configDiv.getAttribute('data-defaultcommentisprivate') === "1",
            addPrivateCommentLabel = configDiv.getAttribute('data-addprivatecommentlabel'),
            privateCommentMessage = configDiv.getAttribute('data-privatecommentmessage'),
            addPrivateCommentOnly = configDiv.getAttribute('data-addprivatecommentonly') === "1";

        // ------------------------------------------------------------------

        var userNameLookup = {};

        var displayComment = function(formId, uname, comment, insertAtTop) {
            var element = $('#'+formId+' div[data-uname="'+uname+'"]');
            var div = $('<div class="z__docstore_comment_container" data-commentid="'+comment.id+'"></div>');
            var header = $('<div class="z__docstore_comment_header"></div>');
            div.append(header);
            header.append($('<div></div>', {
                "class": "z__docstore_comment_datetime",
                text: comment.datetime
            }));
            header.append($('<div></div>', {
                "class": "z__docstore_comment_username",
                text: (userNameLookup[comment.uid]||'')
            }));
            var canEdit = comment.currentUserCanEdit;
            var text = comment.comment;
            if(text === "") {
                text = "(this comment has been deleted)";
                canEdit = false;
            }
            _.each(text.split(/[\r\n]+/), function(p) {
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
            var privateMsg;
            if(comment.isPrivate) {
                div.addClass("z__docstore_private_comment");
                privateMsg = privateCommentMessage;
            }
            if(versionMsg || privateMsg) {
                var messageDiv = '<div class="z__docstore_comment_different_version_msg">';
                messageDiv += _.map(_.compact([privateMsg, versionMsg]), _.escape).join('<br>');
                header.append(messageDiv);
            }
            var footer = $('<div class="z__docstore_comment_footer"></div>');
            if(comment.lastEditedBy) {
                footer.append('<div class="z__docstore_last_edited_by"><i>Last edited by '+comment.lastEditedBy+'</i></div>');
            }
            if(canEdit) {
                footer.append('<div class="z__docstore_edit_comment_link"><a href="#"><i>Edit comment...</i></a></div>');
            }
            div.append(footer);
            if(insertAtTop) {
                var existingComments = $('.z__docstore_comment_container', element);
                if(existingComments.length) {
                    existingComments.first().before(div);
                    return;
                }
            }
            element.append(div);
        };

        // ------------------------------------------------------------------

        var showComments = isViewer ? configDiv.getAttribute('data-showcomments') === "1" : viewingComments;
        if(showComments) {
            var data = {t:(new Date()).getTime()}; // help prevent naughty browsers caching
            if(onlyViewingCommentsForForm) {
                data.onlyform = onlyViewingCommentsForForm;
            }
            $.ajax(commentServerUrl, {
                data: data,
                dataType: "json",
                success: function(data) {
                    if(data.result !== "success") {
                        window.alert("Failed to load comments");
                        return;
                    }
                    userNameLookup = data.users || {};
                    var hasCommentsToDisplay = false;
                    _.each(data.forms, function(elements, formId) {
                        _.each(elements, function(comments, uname) {
                            _.each(comments, function(comment) {
                                if(comment.currentUserCanView) {
                                    displayComment(formId, uname, comment);
                                    hasCommentsToDisplay = true;
                                }
                            });
                        });
                    });
                    if(!hasCommentsToDisplay) {
                        $('#z__no_comments_warning').show();
                    }
                    if(!filterOn) {
                        if(isViewer) {
                            $('div[data-uname]').show();
                        }
                    } else {
                        var containers = [];
                        $('div[data-uname]').each(function() {
                            if($('div[data-uname]',this).length) {
                                containers.push(this);
                            }
                            // if not showing changes, need to hide if no comments
                            if($('.z__docstore_comment_container',this).length === 0 && !showingChanges) {
                                $(this).hide();
                            // if showing changes, need to un hide if has comments
                            } else if ($('.z__docstore_comment_container',this).length !== 0 && showingChanges) {
                                $(this).show();
                            }
                        });
                        // Now go through the containers, and if there's nothing visible within the container, hide it entirely.
                        // In reverse so parent containers can be hidden if all child containers are
                        _.each(containers.reverse(), function(container) {
                            if($('div[data-uname]:visible',container).length === 0) {
                                $(container).hide();
                            }
                        });
                    }
                },
                error: function(data) {
                    window.alert("Failed to load comments. Please refresh the page and try again.");
                }
            });
        }

        // ------------------------------------------------------------------

        // Adding comments
        if(canAddComment) {
            $('#z__docstore_body div[data-uname]').each(function() {
                // Ignore if this contains other elements with unames, unless all of those elements are in one table
                if($('[data-uname]:not(td)',this).length) { return; }
                if(!/\S/.test(this.innerText||'')) { return; }  // no text/labels to comment on
                $(this).prepend('<div class="z__docstore_add_comment"><a class="z__docstore_add_comment_button" href="#" title="Add comment">Add comment<span></span></a></div>');
            });

            var showAddComment = function(that, commentId, text, isPrivate, successCallback) {
                // Request a fresh comment form from the server, inc. valid form token
                $.ajax(commentFormUrl, {
                    data: {
                        id: commentId,
                        private: (isPrivate !== false) ? 't' : undefined
                    },
                    success: function(html, textStatus, jqXHR) {
                        if(textStatus !== "success") {
                            window.alert("Failed to load comment form");
                            return;
                        }
                        // The comment form handler returns a plain <div>
                        // but an expired session will redirect to the authentication screen
                        // Check for headers before displaying to ensure login page isn't inserted
                        if(html.indexOf('<head>') !== -1) {
                            window.alert("Failed to load comment form. Your session may have expired. Please login and try again.");
                            return;
                        }
                        var commentBox = $(html);
                        var element = $(that).parents('[data-uname]').first();
                        var existingComments = $('.z__docstore_comment_container', element);
                        if(existingComments.length) {
                            existingComments.first().before(commentBox);
                        } else {
                            element.append(commentBox);
                        }
                        // Only hide add buttons etc. on success
                        successCallback(that);
                    },
                    error: function(data) {
                        window.alert("Failed to load comment form. Your session may have expired. Please login and try again.");
                    }
                });
            };

            $('#z__docstore_body').on('click', '.z__docstore_add_comment_button', function(evt) {
                evt.preventDefault();
                showAddComment(this, undefined, undefined, defaultCommentIsPrivate, function(that) {
                    $(that).hide(); // hide button to avoid duplicates
                    var element = $(that).parents('[data-uname]').first();
                    $(element).find(".z__docstore_comment_footer").hide();
                    $('textarea',$(element)).focus();
                });
            });

            $('#z__docstore_body').on('click', '.z__docstore_edit_comment_link', function(evt) {
                evt.preventDefault();
                var commentContainer = $($(this).parents('.z__docstore_comment_container').first());
                var text = _.map(commentContainer.children('p'), function(p) {
                    return $(p).text();
                }).join("\n");
                var isPrivate = commentContainer.hasClass('z__docstore_private_comment');
                var commentToSupersede = commentContainer[0].getAttribute('data-commentid');
                showAddComment(this, commentToSupersede, text, isPrivate, function(that) {
                    var commentContainer = $($(that).parents('.z__docstore_comment_container').first());
                    commentContainer.hide(); // hide comment
                    var element = $(that).parents('[data-uname]').first();
                    $(element).find(".z__docstore_add_comment_button").hide();
                    $(element).find(".z__docstore_comment_footer").hide();
                    $('textarea',$(element)).focus();
                });
            });

            var refreshAddCommentToken = function(that) {
                // Request a fresh comment form from the server, inc. valid form token
                $.ajax(commentFormUrl, {
                    data: {},
                    success: function(html, textStatus, jqXHR) {
                        if(textStatus !== "success" || html.indexOf('<head>') !== -1) {
                            window.alert("Failed to refresh comment form. Your session may have expired. Please login and try again.");
                            return;
                        }
                        // Apply the fresh token to the existing add comment form
                        var newToken = $('input[name=__]', html)[0].value;
                        var element = $(that).parents('[data-uname]').first();
                        $('input[name=__]', element)[0].value = newToken;
                        // Reenable the control once the token is updated
                        toggleCommentControls(that, true);
                    },
                    error: function(data) {
                        // Reenable the control even if unsuccessful
                        // so they can try triggering the refresh again
                        toggleCommentControls(that, true);
                    }
                });
            };

            var restoreCommentControls = function(that, toSupersede) {
                var element = $(that).parents('[data-uname]').first();
                $('.z__docstore_comment_enter_ui', element).remove();
                $('.z__docstore_add_comment_button', element).show();
                if(toSupersede) {
                    $('.z__docstore_comment_container:hidden', element).remove();
                } else {
                    $('.z__docstore_comment_container:hidden', element).show();
                }
                $(element).find(".z__docstore_comment_footer").show();
            };

            // Lock the comment enter UI but keep it onscreen while request is pending
            var toggleCommentControls = function(that, active) {
                var element = $(that).parents('[data-uname]').first();
                $('.z__docstore_comment_enter_ui textarea', element).attr('disabled', !active);
                $('.z__docstore_comment_enter_ui input[type=checkbox]', element).attr('disabled', !active);
                $('.z__docstore_comment_enter_cancel', element).toggle(active);
                $('.z__docstore_comment_enter_submit', element).toggle(active);
                if(active) {
                    $('.z__docstore_comment_enter_submitting', element).remove();
                } else {
                    $('.z__docstore_comment_enter_controls', element).append(
                        '<span class="z__docstore_comment_enter_submitting">'+
                            'Submitting... '+Haplo.html.spinner+
                        '</span>'
                    );
                }
            };

            // Cancel making comment
            $('#z__docstore_body').on('click', 'a.z__docstore_comment_enter_cancel', function(evt) {
                evt.preventDefault();
                restoreCommentControls(this);
            });

            // Submit a comment
            $('#z__docstore_body').on('click', '.z__docstore_comment_enter_ui input[type=submit]', function(evt) {
                evt.preventDefault();
                var that = this;
                var element = $(this).parents('[data-uname]').first();
                var comment = $.trim($('textarea', element).val());
                var isPrivate = addPrivateCommentOnly ||
                    (privateCommentsEnabled && element.find("#commment_is_private").first().is(":checked"));
                var commentToSupersede = $(this).parents('.z__docstore_comment_enter_ui').first()[0].getAttribute('data-commentid');
                toggleCommentControls(this, false);

                if(comment || commentToSupersede) {
                    var formId = element.parents('.z__docstore_form_display').first()[0].id,
                        uname = element[0].getAttribute('data-uname'),
                        token = $('input[name=__]', element)[0].value;   // CSRF token
                    $.ajax(commentServerUrl, {
                        method: "POST",
                        data: {
                            __: token,
                            version: displayedVersion,
                            form: formId,
                            uname: uname,
                            comment: comment,
                            private: isPrivate,
                            supersedesid: commentToSupersede
                        },
                        dataType: "json",
                        success: function(data) {
                            if(data.result !== "success") {
                                window.alert("Failed to add comment");
                                toggleCommentControls(that, true);
                                return;
                            }
                            userNameLookup[data.comment.uid] = data.commentUserName;
                            restoreCommentControls(that, commentToSupersede);
                            displayComment(formId, uname, data.comment, true /* at top, so reverse ordered by date to match viewing */);
                        },
                        error: function(data) {
                            window.alert("Failed to add comment, please try again.\nIf the problem persists, try re-adding your comment after refreshing the page.");
                            // Attempt to fetch a fresh comment form and use to refresh the token
                            refreshAddCommentToken(that);
                        }
                    });
                } else {
                    restoreCommentControls(that, commentToSupersede);
                }
            });

            // Reflect privacy of comment
            $('#z__docstore_body').on('click', '.z__docstore_comment_enter_ui input[type=checkbox]', function() {
                var element = $(this).parents("div.z__docstore_comment_enter_ui").first();
                if($(this).is(":checked")) {
                    element.addClass("z__docstore_private_comment");
                } else {
                    element.removeClass("z__docstore_private_comment");
                }
            });

        }

    });

})(jQuery);
