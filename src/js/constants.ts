const VITALSTRASHOLD = {
    lcp : [2.5,4],
    inp : [200,500],
    cls : [0.1,0.25],
    fcp : [1.8,3],
    ttfb : [0.8,1.8]
}

const VITALSID = Object.keys(VITALSTRASHOLD);

const DBNAME = 'Pagespeedsnap';
const OBJECTNAME = 'snaps';

export { VITALSTRASHOLD, VITALSID, DBNAME, OBJECTNAME };