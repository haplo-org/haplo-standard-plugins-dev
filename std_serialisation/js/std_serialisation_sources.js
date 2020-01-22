
P.implementService("std:serialiser:discover-sources", function(source) {
    source({
        name: "std:workunit",
        sort: 1000,
        setup(serialiser) {},
        apply(serialiser, object, serialised) {
            // Use property named 'workflows' to match usual use of work units.
            let workflows = serialised.workflows = [];
            let workunits = O.work.query().
                ref(object.ref).
                isEitherOpenOrClosed().
                isVisible();
            _.each(workunits, (wu) => {
                let work = {
                    workType: wu.workType,
                    createdAt: serialiser.formatDate(wu.createdAt),
                    openedAt: serialiser.formatDate(wu.openedAt),
                    deadline: serialiser.formatDate(wu.deadline),
                    closed: wu.closed,
                    data: _.extend({}, wu.data), // data and tags are special objects
                    tags: _.extend({}, wu.tags),
                };
                serialiser.notify("std:workunit:extend", wu, work);
                workflows.push(work);
            });
        }
    });
});

