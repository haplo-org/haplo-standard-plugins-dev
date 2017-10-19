/* Haplo Platform                                     http://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017    http://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var DashboardAggregate = function() {
};

P.dashboardConstructors["aggregate"] = DashboardAggregate;

// --------------------------------------------------------------------------

var cells = function(s, defaultValue) {
    if(typeof(s) === "string") {
        return O.service(s);
    }
    return s || defaultValue;
};

var DEFAULT_X = [{}],
    DEFAULT_Y = [{}],
    DEFAULT_OUTER_X = [{}],
    DEFAULT_OUTER_Y = [{}],
    DEFAULT_FORMATTER = O.numberFormatter("0.##");

// --------------------------------------------------------------------------

DashboardAggregate.prototype = new P.Dashboard();

// Support but ignore some functions from list dashboard to make common setup easier
DashboardAggregate.prototype.columns = function() {};
DashboardAggregate.prototype.hasColumnBasedOnFact = function() { return false; };

DashboardAggregate.prototype._calculateValues = function() {
    var x = cells(this.specification.x, DEFAULT_X),
        y = cells(this.specification.y, DEFAULT_Y),
        yHasTitles = !!y[0].title,
        outerX = cells(this.specification.outerX, DEFAULT_OUTER_X),
        outerY = cells(this.specification.outerY, DEFAULT_OUTER_Y),
        outerXhasTitles = !!outerX[0].title,
        outerYhasTitles = !!outerY[0].title;

    var aggregate = this.specification.aggregate || 'COUNT',
        fact = this.specification.fact || 'ref';

    var formatter = this.specification.formatter || DEFAULT_FORMATTER;

    var values = [];

    // Titles along top
    if(outerXhasTitles) {
        var outerTitleRow = outerYhasTitles ? [{}] : [];
        if(yHasTitles) { outerTitleRow.push({}); }
        for(var toyx = 0; toyx < outerX.length; ++toyx) {
            outerTitleRow.push({th:outerX[toyx].title, colspan:x.length});
        }
        values.push(outerTitleRow);
    }
    if(x[0].title) {
        var titleRow = outerYhasTitles ? [{}] : [];
        if(yHasTitles) { titleRow.push({}); }
        for(var xtoyx = 0; xtoyx < outerX.length; ++xtoyx) {
            for(var z = 0; z < x.length; ++z) {
                titleRow.push({th:x[z].title});
            }
        }
        values.push(titleRow);
    }

    // Calcuate values in cells
    // Iterate over outer Y
    for(var oyi = 0; oyi < outerY.length; ++oyi) {
        var oys = outerY[oyi];

        // Iterate over inner Y
        for(var yi = 0; yi < y.length; ++yi) {
            var ys = y[yi];

            // Row started in inner Y
            var row = [];
            if(outerYhasTitles) {
                // Outer Y title goes in first cell of first row in each outer Y
                row.push((yi === 0) ? {th:oys.title} : {});
            }
            if(yHasTitles) {
                row.push({th:ys.title});
            }

            // Iterate over outer X
            for(var oxi = 0; oxi < outerX.length; ++oxi) {
                var oxs = outerX[oxi];

                // Iterate over inner X
                for(var xi = 0; xi < x.length; ++xi) {
                    var xs = x[xi];

                    // Calculate value
                    var q = this.select();
                    if(oys.filter) { oys.filter(q); }
                    if(ys.filter)  { ys.filter(q); }
                    if(oxs.filter) { oxs.filter(q); }
                    if(xs.filter)  { xs.filter(q); }

                    var v = q.aggregate(aggregate, fact);
                    row.push({
                        v: v,
                        display: formatter(v),
                        isZero: v === 0
                    });
                }

            }

            values.push(row);

        }

    }

    return values;
};

DashboardAggregate.prototype._makeDashboardView = function() {
    return {
        dashboard: this,
        values: this._calculateValues()
    };
};

// Only renders the table
DashboardAggregate.prototype.deferredRender = function() {
    return P.template("dashboard/aggregate/aggregate-table").deferredRender(this._makeDashboardView());
};

DashboardAggregate.prototype._respondWithExport = function() {
    var values = this._calculateValues();
    var xls = O.generate.table.xlsx(this.specification.title);
    xls.newSheet(this.specification.title);
    values.forEach(function(row) {
        row.forEach(function(cell) {
            if(cell.th) {
                xls.cell(cell.th);
                if(cell.colspan) {
                    for(var i = 1; i < cell.colspan; ++i) { xls.cell(); }
                }
                xls.styleCells(xls.columnIndex, xls.rowIndex, xls.columnIndex, xls.rowIndex, "FONT", "BOLD");
            } else {
                xls.cell(cell.v);
            }
        });
        xls.nextRow();
    });
    this.E.response.body = xls;
};

DashboardAggregate.prototype.respond = function() {
    this._callFinalServices();
    this.E.setResponsiblePlugin(P);
    if(this.isExporting) { return this._respondWithExport(); }
    this.E.render(this._makeDashboardView(), "dashboard/aggregate/aggregate_dashboard");
    return this;
};
