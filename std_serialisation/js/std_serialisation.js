
P.implementService("std:serialisation:serialiser", function() {
    return new Serialiser();
});

// --------------------------------------------------------------------------

var descLookup, labelLookup, sources;

// TODO: Ensure these match types in schema requirements
var descTypeNames = {};
descTypeNames[O.T_OBJREF] = "link";
descTypeNames[O.T_TEXT_PLUGIN_DEFINED] = "plugin";
descTypeNames[O.T_DATETIME] = "datetime";
descTypeNames[O.T_INTEGER] = "integer";
descTypeNames[O.T_NUMBER] = "number";
descTypeNames[O.T_ATTRIBUTE_GROUP] = "attribute-group";
descTypeNames[O.T_TEXT] = "text";
descTypeNames[O.T_TEXT_PARAGRAPH] = "text-paragraph";
descTypeNames[O.T_TEXT_DOCUMENT] = "text-document";
descTypeNames[O.T_TEXT_FORMATTED_LINE] = "text-formatted-line";
descTypeNames[O.T_TEXT_MULTILINE] = "text-multiline";
descTypeNames[O.T_IDENTIFIER_FILE] = "file";
descTypeNames[O.T_IDENTIFIER_ISBN] = "isbn";
descTypeNames[O.T_IDENTIFIER_EMAIL_ADDRESS] = "email-address";
descTypeNames[O.T_IDENTIFIER_URL] = "url";
descTypeNames[O.T_IDENTIFIER_UUID] = "uuid";
descTypeNames[O.T_IDENTIFIER_POSTCODE] = "postcode";
descTypeNames[O.T_IDENTIFIER_TELEPHONE_NUMBER] = "telephone-number";
descTypeNames[O.T_TEXT_PERSON_NAME] = "person-name";
descTypeNames[O.T_IDENTIFIER_POSTAL_ADDRESS] = "postal-address";
descTypeNames[O.T_IDENTIFIER_CONFIGURATION_NAME] = "configuration-name";

// --------------------------------------------------------------------------

const UNKNOWN = "UNKNOWN";

// --------------------------------------------------------------------------

var formatDate = function(d) {
    return d ? (new XDate(d)).toISOString() : null;
};

// --------------------------------------------------------------------------

var Serialiser = function() {
    this.$useAllSources = false;
    this.$useSources = [];
    this.$excludeSources = [];
    this.$expandValue = {};
    this.$listeners = {};
};

Serialiser.prototype = {  

    useAllSources() {
        this._checkNotSetup();
        this.$useAllSources = true;
        return this;
    },

    useSource(name) {
        this._checkNotSetup();
        this.$useSources.push(name);
        return this;
    },

    excludeSource(name) {
        this._checkNotSetup();
        this.$excludeSources.push(name);
        return this;
    },

    expandValue(typecode, fn) {
        let existing = this.$expandValue[typecode];
        if(existing) {
            this.$expandValue[typecode] = function(value, valueSerialised) {
                existing(value, valueSerialised);
                fn(value, valueSerialised);
            };
        } else {
            this.$expandValue[typecode] = fn;
        }
    },

    listen(identifier, fn) {
        let existing = this.$listeners[identifier];
        if(existing) {
            // TODO: Is more than three args needed?
            this.$listeners[identifier] = function(a, b, c) {
                existing(a, b, c);
                fn(a, b, c);
            };
        } else {
            this.$listeners[identifier] = fn;
        }
    },

    notify(identifier, a, b, c) {
        let fn = this.$listeners[identifier];
        if(fn) { fn(a, b, c); }
    },

    _checkNotSetup() {
        if(this.$doneSetup) {
            throw new Error("Cannot change options after serialiser has been used.");
        }
    },

    _setup() {
        if(this.$doneSetup) { return; }

        if(!descLookup) {
            descLookup = {};
            for(let k in SCHEMA.ATTR) { descLookup[SCHEMA.ATTR[k]] = k; }
        }
        if(!labelLookup) {
            labelLookup = O.refdict();
            for(let k in SCHEMA.LABEL) { labelLookup.set(SCHEMA.LABEL[k], k); }
        }
        if(!sources) {
            let s = [];
            O.serviceMaybe("std:serialiser:discover-sources", (source) => {
                s.push(source);
            });
            sources = _.sortBy(s, 'sort');
        }

        this.$sources = _.select(sources, (s) => {
            return this.$useAllSources ||
                ((-1 !== this.$useSources.indexOf(s.name)) && (-1 === this.$excludeSources.indexOf(s.name)));
        });
        this.$sources.forEach((s) => {
            if(s.depend) {
                if(!_.find(this.$sources, (source) => source.name === s.depend)) {
                    throw new Error("Source "+s.name+" depends on "+s.depend+" which has not been used.");
                }
            }
            s.setup(this);
        });

        this.$doneSetup = true;
    },

    formatDate: formatDate
};

// --------------------------------------------------------------------------

Serialiser.prototype.encode = function(object) {
    this._setup();

    // Serialise basics about this object
    let serialised = {
        kind: "haplo:object:0",
        sources: this.$sources.map((s) => s.name)
    };
    let ref = object.ref;
    if(ref) {
        serialised.ref = ref.toString();
        serialised.url = object.url(true);
        let b = ref.getBehaviourExactMaybe();
        if(b) { serialised.behaviour = b; }
    }
    serialised.recordVersion = object.version;  // named so the same one can be used for other data types, and clear it's not the format version
    serialised.title = object.title;
    serialised.labels = _.map(object.labels, (ref) => {
        let l = ref.load(),
            b = ref.getBehaviourExactMaybe(),
            s = {
                ref: ref.toString(),
                title: l.title
            };
        if(b) { s.behaviour = b; }
        let c = labelLookup.get(ref);
        if(c) { s.code = c; }
        return s;
    });
    serialised.deleted = !!object.deleted;
    serialised.creationDate = formatDate(object.creationDate);
    serialised.lastModificationDate = formatDate(object.lastModificationDate);

    // Provide type info
    let type = object.firstType();
    if(type) {
        let typeInfo = SCHEMA.getTypeInfo(type);
        if(typeInfo) {
            serialised.type = {
                code: typeInfo.code || UNKNOWN,
                name: typeInfo.name || UNKNOWN,
                rootCode: SCHEMA.getTypeInfo(typeInfo.rootType).code || UNKNOWN,
                annotations: typeInfo.annotations
            };
        }
    }
    if(!serialised.type) {
        // Provide some defaults, so consumer code can rely on the type property existing
        serialised.type = {
            code: UNKNOWN,
            name: UNKNOWN,
            rootCode: UNKNOWN,
            annotations: []
        };
    }

    // Serialise the attributes
    let attributes = serialised.attributes = {};
    let expandValue = this.$expandValue;
    object.each((v,d,q,x) => {
        let code = descLookup[d];
        if(code) {
            let values = attributes[code];
            if(!values) { values = attributes[code] = []; }
            let typecode = O.typecode(v),
                typecodeName = descTypeNames[typecode];
            if(typecodeName) {
                let vs = {
                    type: typecodeName
                };
                if(x) {
                    vs.extension = {
                        desc: x.desc,
                        groupId: x.groupId
                    };
                }
                switch(typecode) {

                    case O.T_OBJREF:
                        vs.ref = v.toString();
                        let b = v.getBehaviourExactMaybe();
                        if(b) { vs.behaviour = b; }
                        if(d === ATTR.Type) {
                            let typeInfo = SCHEMA.getTypeInfo(v);
                            if(typeInfo) {
                                vs.code = typeInfo.code;
                                vs.title = typeInfo.name;
                            }
                        } else {
                            let o = v.load();
                            vs.title = o.title;
                        }
                        break;

                    case O.T_TEXT_PLUGIN_DEFINED:
                        vs.type = v._pluginDefinedTextType; // overrides the typecode's name for ease of use
                        vs.value = (v.toFields()||{}).value;
                        vs.readable = v.toString();
                        break;

                    case O.T_DATETIME:
                        vs.start = formatDate(v.start);
                        vs.end = formatDate(v.end);
                        vs.specifiedAsRange = !!v.specifiedAsRange;
                        vs.precision = v.precision;
                        vs.timezone = v.timezone;
                        vs.readable = v.toString();
                        break;

                    case O.T_IDENTIFIER_FILE:
                        vs.digest = v.digest;
                        vs.fileSize = v.fileSize;
                        vs.mimeType = v.mimeType;
                        vs.filename = v.filename;
                        vs.trackingId = v.trackingId;
                        vs.version = v.version;
                        vs.logMessage = v.logMessage;
                        let file = O.file(v);
                        if(file) {
                            vs.url = file.url({asFullURL:true});
                        }
                        break;

                    case O.T_IDENTIFIER_TELEPHONE_NUMBER:
                    case O.T_TEXT_PERSON_NAME:
                    case O.T_IDENTIFIER_POSTAL_ADDRESS:
                        let fields = v.toFields();
                        delete fields.typecode;
                        vs.value = fields;
                        vs.readable = v.toString();
                        break;

                    default:
                        vs.value = v.toString();
                        break;
                }

                // A source may wish to add additional information
                let expandFn = expandValue[typecode];
                if(expandFn) {
                    expandFn(v, vs);
                }

                values.push(vs);
            }
        }
    });

    this.$sources.forEach((s) => {
        s.apply(this, object, serialised);
    });

    return serialised;
};
