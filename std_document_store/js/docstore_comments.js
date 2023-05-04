
// checkPermissions called with key & action, where action is 'addComment', 'viewComments', 'viewCommentsOtherUsers' or 'editComments'
P.implementService("std:document_store:comments:respond", function(E, docstore, key, checkPermissions) {
    E.response.kind = 'json';

    // Check permission
    if(!checkPermissions(key, (E.request.method === "POST") ? 'addComment' : 'viewComments')) {
        E.response.body = JSON.stringify({result:"error",message:"Permission denied"});
        E.response.statusCode = HTTP.UNAUTHORIZED;
        return;
    }

    var lastTransitionTime = key.timelineSelect().
        where('previousState', '<>', null).
        order('datetime', true).
        limit(1)[0].datetime;

    var instance = docstore.instance(key);
    var response = {result:"success"};

    if(E.request.method === "POST") {
        // Add a comment for this user
        var version = parseInt(E.request.parameters.version,10),
            formId = E.request.parameters.form,
            elementUName = E.request.parameters.uname,
            comment = E.request.parameters.comment,
            supersedesId = E.request.parameters.supersedesid;

        var oldCommentRow, userCanEditComment;
        if(supersedesId) {
            var oldCommentQ = docstore.commentsTable.select().where("id", "=", parseInt(supersedesId, 10));
            if(oldCommentQ.length) {
                oldCommentRow = oldCommentQ[0];
                userCanEditComment = currentUserCanEditComment(oldCommentRow, key, checkPermissions, lastTransitionTime, docstore.delegate.editCommentsOtherUsers, docstore.delegate.alwaysEditOwnComments);
            }
        }
        if(supersedesId && !userCanEditComment) {
            response.result = "error";
            response.method = "Not permitted";
        } else if(!(version && formId && elementUName && (formId.length < 200) && (elementUName.length < 200) && (comment.length < 131072))) {
            response.result = "error";
            response.method = "Bad parameters";
        } else {
            var rowProperties = {
                keyId: instance.keyId,
                version: version,
                userId: oldCommentRow ? oldCommentRow.userId : O.currentUser.id,
                datetime: new Date(),
                formId: formId,
                elementUName: elementUName,
                comment: comment || "",
                isPrivate: isPrivate(E.request.parameters)
            };
            // i.e. has been edited by another user
            if(rowProperties.userId !== O.currentUser.id) {
                rowProperties.lastEditedBy = O.currentUser.id;
            } else if(oldCommentRow && oldCommentRow.lastEditedBy) {
                rowProperties.lastEditedBy = oldCommentRow.lastEditedBy;
            }
            var row = docstore.commentsTable.create(rowProperties);
            row.save();
            response.comment = rowForClient(row, key, checkPermissions, lastTransitionTime, docstore.delegate);
            response.commentUserName = O.securityPrincipal(row.userId).name;
            if(supersedesId) {
                if(userCanEditComment) {
                    oldCommentRow.supersededBy = row.id;
                    oldCommentRow.save();
                }
            }
        }

    } else {
        // Return all comments for this document
        var users = {}, forms = {};
        var allComments = docstore.commentsTable.select().
            where("keyId","=",instance.keyId).
            order("datetime", true);    // latest comments first
        var onlyCommentsForForm = E.request.parameters.onlyform;
        if(onlyCommentsForForm) { allComments.where("formId","=",onlyCommentsForForm); }
        _.each(allComments, function(row) {
            var form = forms[row.formId];
            if(!form) { form = forms[row.formId] = {}; }
            var comments = form[row.elementUName];
            if(!comments) { comments = form[row.elementUName] = []; }
            var commentRow = rowForClient(row, key, checkPermissions, lastTransitionTime, docstore.delegate);
            if(commentRow) {
                comments.push(commentRow);
            }
            var uid = row.userId;
            if(!users[uid]) {
                users[uid] = O.user(uid).name;
            }
        });
        //attempt to omit users (for name display) if deny is specified and spec is matched (no real use at the moment for this to be additive), otherwise allow all names to be viewed
        if(!checkPermissions(key, "viewCommenterName")) {
            _.each(docstore.delegate.viewCommenterName, function(obj) {
                if(obj.action === "deny") {
                    var currentUserMatchesRoleMaybe = (!obj.roles || !obj.roles.length) ? true : key.hasAnyRole(O.currentUser, obj.roles);
                    var isSelectedMaybe = obj.selector ? key.selected(obj.selector) : true;
                    var commenterRoleSpecified = obj.commenter && obj.commenter.length;
                    if(currentUserMatchesRoleMaybe && isSelectedMaybe) {
                        if(!commenterRoleSpecified) {
                            users = {};
                        } else {
                            var commenterRoles = {};
                            var setRoleNames = function(userId, newDisplayName) {
                                if(commenterRoles[userId]) {
                                    commenterRoles[userId].push(newDisplayName);
                                } else {
                                    commenterRoles[userId] = [newDisplayName];
                                }
                                return commenterRoles;
                            };
                            _.each(_.keys(users), function(k) {
                                _.each(obj.commenter, function(commenterRole) {
                                    if(key.hasRole(O.securityPrincipal(parseInt(k)), commenterRole)) {
                                        if(obj.replacementRoleNames && obj.replacementRoleNames[commenterRole]) {
                                            setRoleNames(k, obj.replacementRoleNames[commenterRole]);
                                        } else {
                                            //This is probably less useful than it seems given some entity names, but e.g. peerReviewer -> Peer Reviewer as opposed to nothing?
                                            //Maybe add config so this doesn't happen by default or remove?
                                            setRoleNames(k, _.titleize(_.humanize(commenterRole)));
                                        }
                                    }
                                });
                            });
                            // This (.join(/)) isn't that useful unless we can pass all entities that can comment explicitly
                            // The only case in which it would be useful was if "commenter" had multiple roles in held by one person
                            _.each(commenterRoles, function(roleNames, userId) {
                                users[userId] = _.uniq(roleNames).join("/");
                            });
                        }
                    }
                }
            });
        }
        response.users = users;
        response.forms = forms;
    }

    E.response.body = JSON.stringify(response);
});

// --------------------------------------------------------------------------

var rowForClient = function(row, key, checkPermissions, lastTransitionTime, delegate) {
    // return info if the comment is not superseded by another comment
    if(!row.supersededBy) {
        return {
            id: row.id,
            uid: row.userId,
            version: row.version,
            datetime: P.template("comment_date").render({commentDate: new Date(row.datetime)}),
            comment: row.comment,
            isPrivate: row.isPrivate,
            currentUserCanEdit: currentUserCanEditComment(row, key, checkPermissions, lastTransitionTime, delegate.editCommentsOtherUsers, delegate.alwaysEditOwnComments),
            currentUserCanView: currentUserCanViewComment(row, key, checkPermissions, lastTransitionTime, delegate.viewCommentsOtherUsers),
            lastEditedBy: row.lastEditedBy ? O.user(row.lastEditedBy).name : undefined
        };
    }
};

var isPrivate = function(parameters) {
    switch(parameters.private) {
        case "true": return true;
        case "false": return false;
        default: return null; // may be null if private comments aren't enabled
    }
};
 
var checkAdditionalCommentPermissions = function(M, permissionsSpec, commentRow, checkPermissions) {
    var checkPrivacyPermissionsForRow = function(M, row) {
        if(!checkPermissions(M, 'viewPrivateComments') && row.isPrivate) {
            return false;
        }
        return true;
    };
    var checkCommentFlags = function(obj, commentRow) {
        if(obj.commentFlags && obj.commentFlags.length) {
            return !!_.intersection(obj.commentFlags, commentRow.commentFlags || []).length;
        }
        return true;
    };
    var hasValidSelectorOrRole = function(obj, commentRow) {
        if(obj.action && !_.contains(["allow", "deny"], obj.action)) {
            throw new Error("The specified action property is not valid. To deny a role viewing permissions use action: 'deny', to allow viewing permissions you can omit the action property, or, to be explicit, use action: 'allow'.");
        }

        //An empty roles property will allow everyone to read the document
        var currentUserMatchesRoleMaybe = (!obj.roles || !obj.roles.length) ? true : M.hasAnyRole(O.currentUser, obj.roles);
        //An empty commenter property will mean all comments are treated the same no matter who authored them
        var commentAuthorMatchesSpecifiedAuthorMaybe = (!obj.commenter || !obj.commenter.length) ? true : M.hasAnyRole(O.securityPrincipal(commentRow.userId), obj.commenter);
        //An empty selector {} will select on all states
        var isSelectedMaybe = obj.selector ? M.selected(obj.selector) : true;

        return isSelectedMaybe && currentUserMatchesRoleMaybe && commentAuthorMatchesSpecifiedAuthorMaybe;
    };
    //Omitting these objects or specifying an empty list [] means that everyone has permission.
    //if no viewCommentsOtherUsers check privacy since the select filtering seems to break things
    if(!permissionsSpec.length) { return checkPrivacyPermissionsForRow(M, commentRow); }
    // deny if explicit action stated, otherwise treat matching specs that contain commentFlag rules but no matching commentFlag on the comment as deny permissions but only if all other parts of spec also match
    var shouldDeny = _.chain(permissionsSpec).
        clone().
        filter(function(v) {
            return ((v.action === "deny") ||
                (!!v.commentFlags ? hasValidSelectorOrRole(v, commentRow) && !checkCommentFlags(v, commentRow) : false));
        }).
        value();
    var shouldAllow = _.chain(permissionsSpec).
        clone().
        difference(shouldDeny).
        any(function(v) {
            return hasValidSelectorOrRole(v, commentRow) && checkCommentFlags(v, commentRow) && checkPrivacyPermissionsForRow(M, commentRow);
        }).
        value();
    shouldDeny = _.any(shouldDeny, function(d) { return hasValidSelectorOrRole(d, commentRow); });
    return shouldAllow && !shouldDeny;
};

var currentUserCanEditComment = function(commentRow, M, checkPermissions, lastTransitionTime, editCommentsOtherUsers, alwaysEditOwnComments) {
    if(checkPermissions(M, 'editComments') && O.currentUser.id === commentRow.userId) {
        if(alwaysEditOwnComments || lastTransitionTime < commentRow.datetime) {
            return true;
        }
    } else if(editCommentsOtherUsers) {
        return checkAdditionalCommentPermissions(M, editCommentsOtherUsers, commentRow, checkPermissions);
    }
};

var currentUserCanViewComment = function(commentRow, M, checkPermissions, lastTransitionTime, viewCommentsOtherUsers) {
    if(O.currentUser.id === commentRow.userId) {
            return true;
    } else {
        return checkAdditionalCommentPermissions(M, viewCommentsOtherUsers, commentRow, checkPermissions);
    }
};
