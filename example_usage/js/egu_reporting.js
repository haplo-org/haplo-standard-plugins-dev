
P.implementService("std:action_panel:example_reporting", function(display, builder) {
    builder.panel(100).link(100,
        "/do/example-usage/states-dashboard/",
        "Workflow states",
        "default");
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
