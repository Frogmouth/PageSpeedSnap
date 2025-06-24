const storage = {
    getData: function(key) {
        return  new Promise(function(resolve) {
            chrome.storage.local.get(key).then((res) => {
                resolve(res[key]);
            });
        })
    },
    setData: function (key, value) {
        return new Promise(function(resolve) {
            chrome.storage.local.set({
                [key] : value
            }).then(resolve)
        });
    }
};

export default storage;

const { getData, setData } = storage;

export { getData, setData };