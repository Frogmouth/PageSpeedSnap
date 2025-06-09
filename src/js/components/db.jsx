'use strict';

import Dexie from 'dexie';

import {DBNAME, OBJECTNAME, DBVERSION } from '../constants.ts';

const db = new Dexie(DBNAME);

db.version(DBVERSION).stores({
    [OBJECTNAME]: 'id, domain, originalurl, fetchDate'
});

const { snaps } = db;

export default db;

export { snaps };
