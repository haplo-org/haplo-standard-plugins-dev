
P.implementService("std:action_panel:example_reporting", function(display, builder) {
    builder.panel(100).
        link(100, "/do/example-usage/states-dashboard/", "Workflow states", "standard").
        link(101, "/do/example-usage/reporting-dashboard", "Reporting dashboard", "standard");
});

// Workflow dashboard documentation: http://docs.haplo.org/dev/standard-plugin/workflow/definition/std-features/states-dashboard
P.ExampleUsageWorkflow.use("std:dashboard:states", {
    title: "Workflow progress",
    path: "/do/example-usage/states-dashboard",
    canViewDashboard: function(dashboard, user) {
        return true;
    },
    states: [
        "wait_submit",
        "finished"
    ]
});

// --------------------------------------------------------------------------

P.implementService("std:reporting:discover_collections", function(discover) {
    discover("example", "Example");
});

P.implementService("std:reporting:collection:example:setup", function(collection) {
    collection.
        currentObjectsOfType(T.File).
        fact("firstAuthor", "ref", "First author").
        fact("numberOfAuthors", "int", "Number of authors");
});

P.implementService("std:reporting:collection:example:get_facts_for_object", function(object, row) {
    row.firstAuthor = object.first(A.Author);
    row.numberOfAuthors = object.every(A.Author).length;
});

P.respond("GET,POST", "/do/example-usage/reporting-dashboard", [
], function(E) {
    P.reporting.dashboard(E, {
        name: "example_dashboard",
        kind: "list",
        collection: "example",
        title: "Example dashboard"
    }).
        columns(100, [
            {fact:"ref", heading:"File"},
            "numberOfAuthors"
        ]).
        respond();
});
