
var pageParts = {}; // name -> Page Part object as registered with pagePart() function
var pagePartCategories = {}; // category name -> [Page Parts] (sorted)

// Page Part object has properties:
//   name - API code style name
//   category - API code style name of category
//   sort - sort value for ordering parts within category
//   deferredRender(E, context, options)

P.FEATURE.pagePart = function(pagePart) {
    if(typeof(pagePart.name) !== "string") { throw new Error("Page Part must have a name property"); }
    pageParts[pagePart.name] = pagePart;
    if(pagePart.category) {
        var categories = pagePartCategories[pagePart.category];
        if(!categories) { pagePartCategories[pagePart.category] = categories = []; }
        categories.push(pagePart);
    }
};

// --------------------------------------------------------------------------

P.setupPageParts = function() {
    // Sort each category ready for rendering
    // Avoids mutation during iteration
    _.keys(pagePartCategories).forEach(function(category) {
        pagePartCategories[category] = _.sortBy(pagePartCategories[category], 'sort');
    });
};

// --------------------------------------------------------------------------

P.globalTemplateFunction("std:web-publisher:page-part:render", function(name) {
    maybeRenderPagePartForTemplateFunction(this, pageParts[name]);
});

P.globalTemplateFunction("std:web-publisher:page-part:render-category", function(category) {
    var parts = pagePartCategories[category];
    var fnthis = this;
    if(parts) {
        parts.forEach(function(pagePart) {
            maybeRenderPagePartForTemplateFunction(fnthis, pagePart);
        });
    }
});

// --------------------------------------------------------------------------

var deferredRenderPagePart = function(pagePart) {
    var context = P.getRenderingContext();
    var options = context._pagePartOptions[pagePart.name] ||
        context.publication._pagePartOptions[pagePart.name] ||
        {};
    return pagePart.deferredRender(context.$E, context, options);
};

var maybeRenderPagePartForTemplateFunction = function(fnthis, pagePart) {
    if(pagePart) {
        var deferred = deferredRenderPagePart(pagePart);
        if(deferred) {
            fnthis.render(deferred);
        }
    }
};
