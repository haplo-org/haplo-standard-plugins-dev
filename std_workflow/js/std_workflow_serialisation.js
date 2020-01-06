
P.implementService("std:serialiser:discover-sources", function(source) {
    source({
        name: "std:workflow",
        apply(serialiser, object, serialised) {
            let workflows = serialised.workflows = [];
            let workunits = O.work.query().
                ref(object.ref).
                isEitherOpenOrClosed().
                isVisible();
            _.each(workunits, (wu) => {
                let wdefn = O.service("std:workflow:definition_for_name", wu.workType);
                if(wdefn) {
                    let M = wdefn.instance(wu);
                    let work = {
                        workType: wu.workType,
                        createdAt: serialiser.formatDate(wu.createdAt),
                        openedAt: serialiser.formatDate(wu.openedAt),
                        deadline: serialiser.formatDate(wu.deadline),
                        closed: wu.closed,
                        data: _.extend({}, wu.data), // data and tags are special objects
                        tags: _.extend({}, wu.tags),
                        state: M.state,
                        target: M.target,
                        url: O.application.url + M.url,
                        documents: {}
                    };
                    // TODO: Refactor this into its own source, which needs to be dependent on std:workflow
                    _.each(wdefn.documentStore, (store, name) => {
                        work.documents[name] = store.instance(M).lastCommittedDocument;
                    });
                    workflows.push(work);
                }
            });
        }
    });
});

