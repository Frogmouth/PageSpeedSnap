const getData = function(key) {
    return localStorage.getItem(key);
}

const setData = function(key, value) {
    return localStorage.setItem(key, value);
}

export {
    getData, setData
}