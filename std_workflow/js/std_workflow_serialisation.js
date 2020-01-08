
P.implementService("std:serialiser:discover-sources", function(source) {
    source({
        name: "std:workflow",
        depend: "std:workunit",
        sort: 1100,
        setup(serialiser) {
            serialiser.listen("std:workunit:extend", function(workUnit, work) {
                let wdefn = O.service("std:workflow:definition_for_name", workUnit.workType);
                if(wdefn) {
                    let M = wdefn.instance(workUnit);
                    work.state = M.state;
                    work.target = M.target;
                    work.url = O.application.url + M.url;
                    serialiser.notify("std:workflow:extend", wdefn, M, work);
                }
            });
        },
        apply(serialiser, object, serialised) {
            // Implemented as listener
        }
    });
});

