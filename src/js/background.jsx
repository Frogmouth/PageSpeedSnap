'use strict';

import Dexie from 'dexie';
import {DBNAME, OBJECTNAME, DBVERSION } from './constants.ts';

const db = new Dexie(DBNAME);

db.version(DBVERSION).stores({
	[OBJECTNAME]: 'id, domain, originalurl, fetchDate'
});

const {snaps} = db;

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

let transactionCounter = 0;

chrome.runtime.onMessage.addListener((data, sender, sendResponse) => {
  if (data.type === 'SNIFF') {
    
    if(data.payload?.id && data.payload?.domain && data.payload?.originalurl) {
      const datestring = data.payload?.desktop?.fetchTime || data.payload?.mobile?.fetchTime;
      data.payload.fetchDate = datestring && new Date(datestring) || new Date();

      const exec = function() {
        
        console.log("data to store:", data.payload);

        //clear data
        if(data.payload.desktop) clearTestData(data.payload.desktop);
        if(data.payload.mobile) clearTestData(data.payload.mobile);

        data.payload.lastUTCdate = new Date(new Date().toUTCString()).toISOString();

        snaps.put(data.payload).then(function (result) {
          console.log("SNAP added to the store", result);
          sendResponse({
            status : 'completed',
            message: 'Page sniffed',
            errorid: null,
          });
          transactionCounter++;
          chrome.action.setBadgeText({text: (transactionCounter < 100) ? ''+transactionCounter : '+99'})
        }).catch(function (error) {
          console.log("Error", error);
          sendResponse({
            status : 'error',
            message: error && error.toString() || 'DB Error on transaction',
            errorid: 'db-save-error',
          });
        }).finally(function() {
          cleanBadgeCounter();
        });
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
          return false;
        }

        request.then(function(result) {
          console.log("SNAP found", result);
          sendResponse({
            data : result,
            message : result ? "sniff found" : "sniff not found"
          });
        }).catch(function(error) {
          console.log("SNAP not found", error);
          sendResponse({
            data : null,
            message : "snap not found"
          });
        });
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
    sendResponse("MISSING TYPE FOR THIS REQUEST");
  }
  return true;
});
