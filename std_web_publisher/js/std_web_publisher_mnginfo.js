/* Haplo Platform                                     http://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017    http://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.$getPublicationHostnames = function() {
    var publications = [];
    _.each(P.allPublications, function(publicationsOnHostname, hostname) {
        publications.push(
            (hostname === P.FEATURE.DEFAULT) ? O.application.hostname : hostname
        );
    });
    return JSON.stringify(publications);
};

P.$getPublicationInfoHTML = function(givenHostname) {
    var hostname = (givenHostname === O.application.hostname) ? P.FEATURE.DEFAULT : givenHostname;
    var publications = P.allPublications[hostname];
    if(!publications) { return ('(UNKNOWN)'); }
    return P.template("mnginfo/publication-info").render({
        hostname: givenHostname,
        publications: _.map(publications, function(publication) {
            return {
                publication: publication,
                homePageUrl: publication._homePageUrlPath ? "https://"+givenHostname+publication._homePageUrlPath : null,
                serviceUser: O.serviceUser(publication._serviceUserCode),
                robotsTxt: publication._generateRobotsTxt()
            };
        })
    });
};
