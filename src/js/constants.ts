const VITALSTRASHOLD = {
    lcp : [2.5,4],
    inp : [200,500],
    cls : [0.1,0.25],
    fcp : [1.8,3],
    ttfb : [0.8,1.8]
}

const DATERANGES = [30, 60, 90];

const VITALSID = Object.keys(VITALSTRASHOLD);

const DBNAME = 'Pagespeedsnap--test';
const DBVERSION = 1;
const OBJECTNAME = 'snaps';

const DATATYPES = {
    string: {
        label: "Text",
    },
    stringDate: {
        type: "string",
        vlidate: (value) => {
            try{
                return value && new Date(value).toISOString() === value;
            }catch(e){
                return false;
            }
        },
        label: "Date String",
        mutators : [
            { type: "Date", use: (value) => new Date(value)}
        ]
    },
    Date: {
        type: "object",
        validate: (value) => {
            return value && value instanceof Date;
        },
        label: "Date object",
        mutators : [
            {type: "stringDate", use: (value) => value.toISOString()},
            {type: "number", use: (value) => value.getTime()}
        ]
    },
    boolean: {
        label: "Boolean (TRUE/FALSE)"
    },
    number: {
        label: "Number",
        mutators : [
            {type:"string", use: (value) => value.toString()},
            {type:"stringDate", use: (value) => new  Date(value).toISOString()},
            {type:"Date", use: (value) => new Date(value)},
        ]
    }
};

const ERROROPTIONS = [
    {
        id: 'block',
        label: 'Block on each error'
    },
    {
        id: 'blocksave',
        label: 'Block on destination error'
    },
    {
        id: 'skip',
        label: 'No block, skip items with errors'
    }
]

export { VITALSTRASHOLD, VITALSID, DBNAME, OBJECTNAME, DBVERSION, DATATYPES, ERROROPTIONS, DATERANGES };