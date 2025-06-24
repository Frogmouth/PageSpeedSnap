'use strict';

import Dexie from 'dexie';

import {DBNAME, OBJECTNAME, DBVERSION } from '../constants.ts';

import {getData} from './localstorage.ts';

const dbName = (await getData('dbName')) || DBNAME ;
const dbVersion = (await getData('dbVersion')) || DBVERSION ;

const db = new Dexie(dbName);

db.version(dbVersion).stores({
    [OBJECTNAME]: 'id, domain, originalurl, fetchDate'
});

const getDbNames = function () {
    return Dexie.getDatabaseNames();
}

const { snaps } = db;

export default db;

export { snaps, getDbNames };