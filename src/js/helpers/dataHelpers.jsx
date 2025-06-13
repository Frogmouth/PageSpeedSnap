
const testPathOn = function(rule, item) {
    let result = {
        lastprop: null,
        lastvalue: item,
        deep: 0,
    }
    rule.forEach((prop) => {
        result.lastprop = prop;
        result.deep++;
        //ignore root
        if(prop === 'root') return true;

        if(result.lastvalue && prop in result.lastvalue) {
            result.lastvalue = result.lastvalue[prop];
            return true;
        }

        result.lastvalue = undefined;

        return false;
    });

    return result;
}


const setByArrayPath = function(obj, path, value) {
    let lastProp = path.pop();
    for (var i=0, len=path.length; i<len; i++){
        obj = obj[path[i]];
    };
    obj[lastProp] = value;
}

export { testPathOn, setByArrayPath };