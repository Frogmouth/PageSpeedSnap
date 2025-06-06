'use strict';

// With background scripts you can communicate with popup
// and contentScript files.
// For more information on background script,
// See https://developer.chrome.com/extensions/background_pages

const DBNAME = 'Pagespeedsnap';
const OBJECTNAME = 'snaps';
const openRequest = indexedDB.open(DBNAME,1);

let db;
let beforeDbQueue = [];

//methods

const clearTestData = function(data) {
  delete data.fullPageScreenshot;
  delete data.i18n;
  return data;
}

const debounce = function(func, timeout = 15000){
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => { func.apply(this, args); }, timeout);
  };
}

const cleanBadgeCounter = debounce(() => {
  transactionCounter = 0;
  chrome.action.setBadgeText({})
});

openRequest.onupgradeneeded = function(event) {
  console.log("NEED UPGRADE!");
  db = event.target.result;
  if (!db.objectStoreNames.contains('tests')) { 
    console.log("TEST UPGRADES!");
    let snaps = db.createObjectStore(OBJECTNAME, {keyPath: 'id'});
    snaps.createIndex('domain_idx', 'domain');
    snaps.createIndex('originalurl_idx', 'originalurl');
  }
};

openRequest.onerror = function(event) {
  console.error("Error: ", event);
};

openRequest.onsuccess = function(event) {
  console.log("db opened!");
  db = event.target.result;
  if(beforeDbQueue.length) {
    beforeDbQueue.forEach(function (queuedExec) {
      queuedExec();
    })
  }
};

let transactionCounter = 0;

chrome.runtime.onMessage.addListener((data, sender, sendResponse) => {
  if (data.type === 'SNIFF') {
    
    if(data.payload?.id && data.payload?.domain && data.payload?.originalurl) {
      
      const exec = function() {
        let transaction = db.transaction(OBJECTNAME, "readwrite");
        let snaps = transaction.objectStore(OBJECTNAME); 
        
        console.log("data to store:", data.payload);

        //clear data
        if(data.payload.desktop) clearTestData(data.payload.desktop);
        if(data.payload.mobile) clearTestData(data.payload.mobile);

        data.payload.lastUTCdate = new Date(new Date().toUTCString()).toISOString();

        let request = snaps.put(data.payload);
        
        request.onsuccess = function() {
          console.log("SNAP added to the store", request.result);
          sendResponse({
            status : 'completed',
            message: 'Page sniffed',
            errorid: null,
          });
          transactionCounter++;
          chrome.action.setBadgeText({text: (transactionCounter < 100) ? ''+transactionCounter : '+99'})
        };
        
        request.onerror = function() {
          console.log("Error", request.error);
          sendResponse({
            status : 'error',
            message: request.error && request.error.toString() || 'DB Error on transaction',
            errorid: 'db-save-error',
          });
        };
        
        transaction.oncomplete = function() {
          cleanBadgeCounter();
          console.log("Transaction is complete");
        };
      }
      
      if(db) {
        exec();
      } else {
        beforeDbQueue.push(exec);
      }
      
    } else {
      sendResponse({
        status : 'error',
        message: 'Required data missing',
        errorid: 'missing-data',
      });
    }
    
  } else if (data.type === 'QUERY') {
    
    if(data.payload?.id || data.payload?.domain || data.payload?.url) {
      const exec = function() {
        let transaction = db.transaction(OBJECTNAME, "readonly");
        let snaps = transaction.objectStore(OBJECTNAME); 
        
        console.log("get item using:", data.payload);
        
        let request;

        if(data.payload.id) {
          request = snaps.get(data.payload.id);
        } else if (data.payload.domain) {
          const index = snaps.index('domain_idx');
          request = index.getAll(data.payload.domain);
        } else if (data.payload.url) {
          const index = snaps.index('originalurl_idx');
          request = index.getAll(url);

        } else {
          sendResponse("QUERY ERROR!");
        }

        request.onsuccess = function() {
          console.log("SNAP found", request.result);
          sendResponse({
            data : request.result,
            message : request.result ? "sniff found" : "sniff not found"
          });
        };
        
        request.onerror = function() {
          console.log("SNAP not found", request.error);
          sendResponse({
            data : null,
            message : "snap not found"
          });
        };
        
        transaction.oncomplete = function() {
          console.log("Transaction is complete");
        };
      }
      
      if(db) {
        exec();
      } else {
        beforeDbQueue.push(exec);
      }
      
    } else {
      sendResponse("QUERY ERROR!");
    }
  } else {
    sendResponse({});
  }
  return true;
});
