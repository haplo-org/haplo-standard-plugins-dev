
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
                userCanEditComment = currentUserCanEditComment(oldCommentRow, key, checkPermissions, lastTransitionTime, docstore.delegate);
            }
        }
        if(supersedesId && !userCanEditComment) {
            response.result = "error";
            response.method = "Not permitted";
        } else if(!(version && formId && elementUName && (formId.length < 200) && (elementUName.length < 200) && (comment.length < 131072))) {
            response.result = "error";
            response.method = "Bad parameters";
        } else {
            var row = docstore.commentsTable.create({
                keyId: instance.keyId,
                version: version,
                userId: O.currentUser.id,
                datetime: new Date(),
                formId: formId,
                elementUName: elementUName,
                comment: comment || "",
                isPrivate: isPrivate(E.request.parameters)
            });
            row.save();
            response.comment = rowForClient(row, key, checkPermissions, lastTransitionTime, docstore.delegate);
            response.commentUserName = O.currentUser.name;
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
        if(!checkPermissions(key, 'viewCommentsOtherUsers')) {
            allComments.where("userId","=",O.currentUser.id);
        } else if(!checkPermissions(key, 'viewPrivateComments')) {
            allComments.or(function(select) {
                select.where("isPrivate","=",false).where("isPrivate","=",null);
            });
        }
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
        if(checkPermissions(key, "viewCommenterName")) {
            response.users = users;
        }
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
            currentUserCanEdit: currentUserCanEditComment(row, key, checkPermissions, lastTransitionTime, delegate.editCommentsOtherUsers),
            currentUserCanView: currentUserCanViewComment(row, key, checkPermissions, lastTransitionTime, delegate.viewCommentsOtherUsers)
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

var checkAdditionalCommentPermissions = function(M, permissionsSpec, commentRow) {
    var hasValidSelectorOrRole = function(obj, commentRow) {
        if(obj.action && !_.contains(["allow", "deny"], obj.action)) {
            throw new Error("The specified action property is not valid. To deny a role viewing permissions use action: 'deny', to allow viewing permissions you can omit the action property, or, to be explicit, use action: 'allow'.");
        }
        //An empty selector {} will select on all states
        var isSelected = obj.selector ? M.selected(obj.selector) : true;
        //An empty roles property will allow everyone to read the document
        var currentUserMatchesRoleMaybe = (!obj.roles || !obj.roles.length) ? true : M.hasAnyRole(O.currentUser, obj.roles);
        //An empty commenter property will mean all comments are treated the same no matter who authored them
        var commentAuthorMatchesSpecifiedAuthorMaybe = (!obj.commenter || !obj.commenter.length) ? true : M.hasAnyRole(O.securityPrincipal(commentRow.userId), obj.commenter);
        return isSelected && currentUserMatchesRoleMaybe && commentAuthorMatchesSpecifiedAuthorMaybe;
    };
    //Omitting these objects or specifying an empty list [] means that everyone has permission.
    if(!permissionsSpec.length) { return true; }
    var denySpecs = _.filter(permissionsSpec, (v) => v.action === "deny");
    if(denySpecs.length) {
        if(_.any(denySpecs,(d) => hasValidSelectorOrRole(d, commentRow))) {
            return false;
        } else {
            permissionsSpec = _.chain(permissionsSpec).
                clone(this).
                difference(this, denySpecs).
                value();
        }
    }
    return permissionsSpec.length ? _.any(permissionsSpec, (v) => hasValidSelectorOrRole(v, commentRow)) : true;
};

var currentUserCanEditComment = function(commentRow, M, checkPermissions, lastTransitionTime, editCommentsOtherUsers) {
    if(checkPermissions(M, 'editComments') && O.currentUser.id === commentRow.userId) {
        if(lastTransitionTime < commentRow.datetime) {
            return true;
        }
    } else if(editCommentsOtherUsers) {
        return checkAdditionalCommentPermissions(M, editCommentsOtherUsers, commentRow);
    }
};

var currentUserCanViewComment = function(commentRow, M, checkPermissions, lastTransitionTime, viewCommentsOtherUsers) {
    if(O.currentUser.id === commentRow.userId) {
        if(lastTransitionTime < commentRow.datetime) {
            return true;
        }
    } else if(viewCommentsOtherUsers) {
        return checkAdditionalCommentPermissions(M, viewCommentsOtherUsers, commentRow);
    }
};
