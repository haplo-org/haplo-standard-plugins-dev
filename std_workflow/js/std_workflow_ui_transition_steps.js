/* Haplo Platform                                    https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2020            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */



P.db.table("stepsUIData", {
    workUnitId: {type:"int"},
    userId:     {type:"int"},
    transition: {type:"text", nullable:true},
    data:       {type:"json"}
});

// --------------------------------------------------------------------------

var TransitionStepsUI = function(M) {
    var steps = [];
    M._callHandler('$transitionStepsUI', function(spec) {
        steps.push(spec);
    });

    // If this workflow isn't using the steps UI, flag as unused
    // and don't do any further initialisation.
    if(steps.length === 0) {
        this._unused = true;
        return;
    }

    this.M = M;
    this._steps = _.sortBy(steps, 'sort');
    this._userId = O.currentUser.id;

    var q = P.db.stepsUIData.select().
        where("workUnitId", "=", M.workUnit.id).
        where("userId", "=", this._userId);
    this._data = q.length ? q[0] : P.db.stepsUIData.create({
        workUnitId: M.workUnit.id,
        userId: this._userId,
        data: {}
    });
};

TransitionStepsUI.prototype = {

    saveData: function() {
        this._data.data = this._data.data;  // ensure field is marked as dirty
        this._data.save();
    },

    nextRedirect: function() {
        var reqRdr = this.nextRequiredRedirect();
        return reqRdr ? reqRdr : this.M.transitionUrl();
    },

    nextRequiredRedirect: function() {
        if(this._unused) { return; }
        var currentStep = this._currentStep();
        if(currentStep) {
            return this._callStepFn(currentStep, 'url');
        }
    },

    _commit: function(transition) {
        if(this._unused) { return; }
        var ui = this;
        this._steps.forEach(function(step) {
            ui._callStepFn(step, 'commit', transition);
        });
        // Delete all the pending data for this workflow, including
        // for any other users who may have started the process.
        P.db.stepsUIData.select().
            where("workUnitId", "=", this.M.workUnit.id).
            deleteAll();
    },

    _currentStep: function() {
        var ui = this;
        return this._findStep(function(step) {
            return !ui._stepIsComplete(step);
        });
    },

    _stepIsComplete: function(step) {
        return this._callStepFn(step, 'complete');
    },

    _findStep: function(f) {
        var steps = this._steps,
            l = steps.length;
        for(var i = 0; i < l; ++i) {
            var s = steps[i];
            if(f(s)) { return s; }
        }
    },

    _callStepFn: function(step, fnname /*, ... */) {
        var fn = step[fnname];
        if(fn) {
            var functionArguments = Array.prototype.slice.call(arguments, 0);
            functionArguments[0] = this.M;
            functionArguments[1] = this;
            return fn.apply(step, functionArguments);
        }
    }
};

TransitionStepsUI.prototype.__defineGetter__('data', function() {
    return this._data.data;
});

// --------------------------------------------------------------------------

P.WorkflowInstanceBase.prototype.__defineGetter__("transitionStepsUI", function() {
    var stepsUI = this._stepsUI;
    if(!stepsUI) {
        this._stepsUI = stepsUI = new TransitionStepsUI(this);
    }
    return stepsUI;
});
