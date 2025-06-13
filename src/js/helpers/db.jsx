'use strict';

import Dexie from 'dexie';

import {DBNAME, OBJECTNAME, DBVERSION } from '../constants.ts';

import { getData } from './localstorage.jsx';

const db = new Dexie(getData('dbName') || DBNAME);

db.version(getData('dbVersion') ||  DBVERSION).stores({
    [OBJECTNAME]: 'id, domain, originalurl, fetchDate'
});

const getDbNames = function () {
    return Dexie.getDatabaseNames();
}

const { snaps } = db;

export default db;

export { snaps, getDbNames };