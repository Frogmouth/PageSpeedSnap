'use strict';

import React, { useEffect, useRef, useState, useMemo} from 'react';
import { Col, Container, Navbar, Form, Row, Button, Card, InputGroup } from 'react-bootstrap';
import { createRoot } from 'react-dom/client';

import {DBNAME, DATATYPES, VITALSTRASHOLD, DBVERSION, ERROROPTIONS } from './constants.ts';

import { getData, setData } from './helpers/localstorage.ts';
import { testPathOn } from './helpers/dataHelpers.jsx';
import db, { snaps, getDbNames } from './helpers/db.ts';


const debounce = function(func, timeout = 2000){
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => { func.apply(this, args); }, timeout);
  };
}

const Settings = () => {

    const [dbname, setDbname] = useState('');
    const [dbVersion, setDbVersion] = useState('');
    const [vitalsTrashold, setVitalsTrashold] = useState('');
    const [originPath, setOriginPath] = useState('');
    const [originType, setOriginType] = useState('');
    const [enableDesitnation, setEnableDestination] = useState(false);
    const [destinationPath, setDestinationPath] = useState('');
    const [options, setOptions] = useState({
        savemode: 'empty',
        drymode: true,
        onerror: 'block'
    })
    const [loading, setLoading] = useState(false);
    const [mutator, setMutator] = useState('');
    const [dbNames, setDbnames] = useState([]);

    const [originDb, setOriginDb] = useState('');
    const [targetDb, setTargetDb] = useState('');

    const dbNamesDestination = useMemo(() => {
        return dbNames?.filter((n) => n !== originDb) || [];
    }, [originDb,dbNames])

    const dataform = useRef();

    useEffect(async () => {
        const name = await getData('dbName')
        setDbname(await getData('dbName') || DBNAME);
        setOriginDb(await getData('dbName') || DBNAME);
        setDbVersion(await getData('dbVersion') || DBVERSION)
        setVitalsTrashold(await getData('vitalsTrashold') || JSON.stringify(VITALSTRASHOLD))
        getDbNames().then((names) => setDbnames(names)).catch(() => setDbnames(null));
    }, []);
    
    useEffect(() => {
        if(!!mutator) {
            const $select = dataform.current?.querySelector('#destinationtype');
            $select?.classList.remove('opacity-100');
            setTimeout(() => {
                $select?.classList.add('opacity-100');
            }, 500);
            setMutator('');
        }
    }, [originType])

    const debouceSave = debounce(function() {
        setData('dbName', dbname);
        setData('dbVersion', dbVersion);
        setData('vitalsTrashold', vitalsTrashold);
    });

    const applyRules = function(rules, items, callbacks) {
        
        items = items || [];

        const defaultCallbacks = {
            onPathResult: () => true,
            onError: () => true
        }

        callbacks = callbacks || {};
        callbacks = {...defaultCallbacks, ...callbacks};

        let isSuccess = false;

        items.forEach((item, k) => {
            let testResult;
            rules.forEach((rule) => {
                testResult = testPathOn(rule, item);
                if(callbacks.onPathResult({...testResult, index : k, rule}, item)) {
                    isSuccess = true;
                    return false;
                };
            });

            //all good go ignore error log
            if(isSuccess) return true;

            //ingore item in next step
            item.___hasError = true;

            //logs errors
            return callbacks.onError({...testResult, index : k}, item);
        });

        return items.filter(function(item) {
            return !item.___hasError;
        });
    }

    const generateRules = function(path, single) {
        // split paths by "|"
        let rules = path.replace(/ /g, '').split('|');

        // split each paths in prop name using "."
        rules = rules.map(function(rule) {
            return rule.split('.');
        });

        return (single && rules.length > 1) ? [rules[0]] : rules;
    }

    const execProsMove = function () {
        if(!loading && originPath && originType) {

            const typeConfig = DATATYPES[originType];

            if(!typeConfig) throw new Error("No validation type for origin:", originType, `the available types are ${JSON.stringify(Object.key(DATATYPES))}`);

            const opt = {...options};
            setLoading(true);
            setTimeout(async function() {
                const all = await snaps.toArray();

                // split paths by "|"
                const rules = generateRules(originPath);

                //check origin
                const realType = typeConfig.type || originType;
                const typeValidation = typeConfig.vlidate || function(value) { return true };

                let results = {
                    errors: [],
                    total: all.length,
                }

                const passedItems = applyRules(rules, all, {
                    onPathResult: function({lastvalue}, item) {
                        if(typeof lastvalue === realType && !!typeValidation(lastvalue) ) {
                            item.___tempvalue = lastvalue;
                            return true;
                        } else {
                            return false;
                        }
                    },
                    onError: function({lastvalue, lastprop, index}) {
                        if(lastvalue === null || lastvalue === undefined) {
                            results.errors.push([index, 'ORIGIN',"failed to get value from original path", rules])
                        } else if(typeof lastvalue !== realType) {
                            results.errors.push([index, 'ORIGIN',`unexpected type [${typeof lastvalue}] instead [${realType}]`,lastprop])
                        } else if(!typeValidation(lastvalue)) {
                            results.errors.push([index, 'ORIGIN',`${originType} validation failed`,lastprop])
                        } else {
                            results.errors.push([index, 'ORIGIN',`validation fail for an unknow reason for [${originType}]`,lastprop])
                        }

                        return opt.onerror !== 'block';
                    }
                });

                results.passedOrigin = passedItems.length;

                if(enableDesitnation && destinationPath && passedItems.length && passedItems.length === all.length) {

                    setTimeout(function(){
                        // split paths by "|"
                        const destRules = generateRules(destinationPath, true);

                        let passedDestination = applyRules(destRules, all, {
                            onPathResult: function({lastvalue, lastprop, deep, index}, item) {
                                let save = false;
                                if(deep !== destRules[0].length) {      
                                    save = true;
                                    results.errors.push([index, 'DESTINATION',`can't resolve the destination path expect [${deep}/${rules[0].length}]`,lastprop])
                                } else {
                                    switch(opt.savemode) {
                                        case 'empty' :
                                            save = lastvalue === undefined || lastvalue === null;
                                            if(!save) {
                                                results.errors.push([index, 'DESTINATION',`destination not empty`, lastprop])
                                            }
                                            break;
                                        case 'missmatch' :
                                            //same as origin
                                            save = typeof lastvalue !== originType || !typeValidation(lastvalue);
                                            if(!save) {
                                                results.errors.push([index, 'DESTINATION',`destination has same type as origin`, lastprop])
                                            }
                                            break;
                                        case 'force' :
                                            save = true;
                                    }
                                }

                                let finalValue = {...item}.___tempvalue;
                                delete item.___tempvalue; //but no needed with "update" dixie method

                                if(mutator) {
                                    const mutatorObj = typeConfig.mutators?.find((mut) => mut.type === mutator);
                                    if(typeof mutatorObj.use === 'function') {
                                        save = true;
                                        try{
                                            finalValue = mutatorObj.use(finalValue);
                                        }catch(e){
                                            save = false;
                                            results.errors.push([index, 'DESTINATION', 'mutator function error', e]);
                                        }
                                    } else {
                                        save = false;
                                        results.errors.push([index, 'DESTINATION', 'mutator miss use method', mutatorObj]);
                                    }
                                }

                                if (save){
                                    item.___changes = {};
                                    item.___changes[destRules.join(".")] = finalValue
                                }

                                return save;
                            },
                            onError: function() {
                                return opt.onerror === 'skip';
                            }
                        });

                        results.passedDestination = passedDestination.length;
                        
                        if(!opt.drymode) {
                            // SAVE BULK HERE
                            let bulkChanges = passedDestination.map((item) => {return {
                                key: item.id,
                                changes: item.___changes
                            }});
                            
                            snaps.bulkUpdate(bulkChanges).then(function(_result) {
                                results.updatedItems = _result;
                            }).catch(function(_result){
                                results.updatedItems = 0;
                                results.errors.push(['#','DB_UPDATE', 'an error occures on saving...', _result]);
                            })
                            .finally(function(){
                                console.log(results);
                                setLoading(false);    
                            });
                        } else {
                            console.log(results);
                            setLoading(false);
                        }
                    }, 10);
                } else {
                    if(!passedItems.length || passedItems.length !== all.length) {
                        results.errors.push(['#','GENERAL', `Not all items passed the Origin validation (${passedItems.length}/${all.length})`])
                    }
                    console.log(results);
                    setLoading(false);
                }
                
            }, 10);
        }
    }

    useEffect(() => {
        debouceSave();
    }, [dbname, dbVersion, vitalsTrashold]);

    return <div>
        <Navbar className="bg-body-tertiary">
            <Container>
                <Navbar.Brand>PageSpeed SNAP - <small className="text-info">Configurations</small></Navbar.Brand>
            </Container>
        </Navbar>
        <Container className='mt-4'>
            <h3 className='mb-4'>Database configurations</h3>
            <Form>
                <Form.Group as={Row} className="mb-3" controlId="databasename">
                    <Form.Label column sm="2">Database name</Form.Label>
                    <Col sm="10">
                        <Form.Select onInput={(e) => setDbname(e.target.value)} value={dbname}>
                            {dbNames.map((opt, k) => <option key={k} value={opt}>{opt}</option>)}
                        </Form.Select>
                    </Col>
                </Form.Group>
                <Form.Group as={Row} className="mb-3" controlId="databaseversion">
                    <Form.Label column sm="2">Database version</Form.Label>
                    <Col sm="10">
                        <Form.Control type="number" placeholder="Database version" onInput={(e) => setDbVersion(e.target.value)} value={dbVersion} />
                    </Col>
                </Form.Group>
                <Form.Group as={Row} className="mb-3" controlId="vitalsTrashold">
                    <Form.Label column sm="2">Vitals Trashold</Form.Label>
                    <Col sm="10">
                        <Form.Control as="textarea" placeholder="{...}" onInput={(e) => setVitalsTrashold(e.target.value)} value={vitalsTrashold} />
                    </Col>
                </Form.Group>
                <hr className='my-4'/>
            </Form>
            <h3 className='mb-4'>Migration<small> (not work)</small></h3>
            <Form>
                <Row className="align-items-end mb-3">
                    <Form.Group className="mb-2" as={Col} sm="5" controlId='db_origin'>
                        <Form.Label>Origin DB</Form.Label>
                        <Form.Select value={originDb} onChange={(e) => setOriginDb(e.target.value)}>
                            {dbNames.map((opt, k) => <option key={k} value={opt}>{opt}{dbname==opt ? ' (current)' : ''}</option>)}
                        </Form.Select>
                    </Form.Group>
                    <Form.Text as={Col} className='text-center d-none d-sm-block mb-2'>
                        <i style={{fontSize: 24}} className="bi bi-arrow-right"></i>
                    </Form.Text>
                    <Form.Group className="mb-2" as={Col} sm="5" controlId='db_dstination'>
                        <Form.Label>Destination DB</Form.Label>
                        <Form.Select disabled={dbNamesDestination.length < 1} value={targetDb} onChange={(e) => setTargetDb(e.target.value)}>
                            <option value="">--</option>
                            {dbNamesDestination.map((opt, k) => <option key={k} value={opt}>{opt}{dbname==opt ? ' (current)' : ''}</option>)}
                        </Form.Select>
                    </Form.Group>
                </Row>
                <div>
                    <Button size='lg' disabled={loading} onClick={() => alert('this do nothing...')}>Start migration wizard</Button>
                </div>
            </Form>
            <hr className='my-4'/>
            <h3 className='mb-4'>Data Test/Manipulation</h3>
            <Form ref={dataform}>
                <Form.Group as={Row} className="mb-3">
                    <Form.Label htmlFor="origin">Origin path (type)</Form.Label>
                    <Col xs="3">
                        <Form.Select value={originType} onInput={(e) => setOriginType(e.target.value)} id="origintype">
                            <option value=""></option>
                            {Object.keys(DATATYPES).map((typeid) => <option key={typeid} value={typeid}>{DATATYPES[typeid]?.label || typeid}</option>)}
                        </Form.Select>
                    </Col>
                    <Col xs="9">
                        <Form.Control id="origin" placeholder="`root.prop`, `root.prop.childprod`, `root.prop.childprod1|root.prop.childprop2`" onInput={(e) => setOriginPath(e.target.value)} value={originPath} />
                    </Col>
                    <Form.Text className='mt-2'>
                        <code>root.</code> is the item (is ignored)<br/>
                        use <code>.</code> to move trought item subprops <br />
                        use <code>|</code> for an alternative path value if the first is <code>null</code>, <code>undefined</code> or with type differnt the expected, can be more than one.<br/>
                        <code>Arrays</code>/<code>Objects</code> are not supported yet
                    </Form.Text>
                </Form.Group>
                <Card className='mb-4'>
                    <Card.Header>
                        <Form.Group controlId="enabledestination">
                            <Form.Check
                                onChange={(e) => setEnableDestination(e.target.checked)}
                                checked={enableDesitnation}
                                type="checkbox"
                                name="enabledestination"
                                label="Move value to a new destination"
                            />
                            <Form.Text className='mt-2'>
                                Enable this option to move the ORIGIN value to a new DESTINATION in each items
                            </Form.Text>
                        </Form.Group>
                    </Card.Header>
                    <Card.Body style={{opacity: enableDesitnation ? 1 : 0.5}}>
                        <Form.Group className="mb-4">
                            <Form.Label htmlFor='destination'>Destination path</Form.Label>
                            <InputGroup className='mb-2'>
                                <Form.Control disabled={!enableDesitnation} id="destination" placeholder="`root.prop`, `root.prop.childprod`" onInput={(e) => setDestinationPath(e.target.value)} value={destinationPath} />
                                <InputGroup.Text>convert to: </InputGroup.Text>
                                <Form.Select className="fade opacity-25 opacity-100" id="destinationtype" value={mutator} disabled={!DATATYPES[originType]?.mutators?.length} onInput={(e) => setMutator(e.target.value)}>
                                    <option value="">Use origin data</option>
                                    {DATATYPES[originType]?.mutators?.map((mut) => <option key={mut.type} value={mut.type}>{DATATYPES[mut.type].label}</option>)}
                                </Form.Select>
                            </InputGroup>
                            <Form.Text>
                                Expect a single path, <code>|</code> will be ignored and first path in used
                            </Form.Text>
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Form.Label>Override destination data</Form.Label>
                            <Form.Check
                                disabled={!enableDesitnation}
                                checked={options.savemode === 'empty'}
                                id="save-radio"
                                onChange={(e) => setOptions((oldOpt) => ({...oldOpt, savemode:'empty'}))}
                                type="radio"
                                name="savemode"
                                label="Preserve"
                            />
                            <Form.Check
                                disabled={!enableDesitnation}
                                checked={options.savemode === 'missmatch'}
                                id="missmatch-radio"
                                onChange={(e) => setOptions((oldOpt) => ({...oldOpt, savemode:'missmatch'}))}
                                type="radio"
                                name="savemode"
                                label="Override (only if existing data type is different then origin data type)"
                            />
                            <Form.Check
                                disabled={!enableDesitnation}
                                checked={options.savemode === 'force'}
                                id="force-radio"
                                onChange={(e) => setOptions((oldOpt) => ({...oldOpt, savemode:'force'}))}
                                type="radio"
                                name="savemode"
                                label="Override"
                            />
                        </Form.Group>
                        <Form.Group  as={Col} className="mb-3" controlId='drymode'>
                            <Form.Check
                                disabled={!enableDesitnation}
                                checked={options.drymode}
                                id="drymode"
                                onChange={(e) => setOptions((oldOpt) => ({...oldOpt,drymode:e.target.checked}))}
                                type="checkbox"
                                name="drymode"
                                label="Dry run"
                            />
                            <Form.Text muted>
                                If checked the process not change any data on DB, but execute every step and log result
                            </Form.Text>
                        </Form.Group>
                    </Card.Body>
                </Card>
                <Form.Group className="mb-3" controlId='onerror'>
                    <Form.Label sm="2">Error management</Form.Label>
                    <Form.Select value={options.onerror} onInput={(e) => setOptions((oldOpt) => ({...oldOpt,onerror:e.target.value}))}>
                        {ERROROPTIONS.map((opt) => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                    </Form.Select>
                </Form.Group>
                <div>
                    <Button size='lg' disabled={loading} onClick={execProsMove}>{loading ? 'In progress...' : enableDesitnation && options.drymode && 'Dry Run' || 'Run'}</Button>
                </div>
            </Form>
        </Container>
    </div>
}

createRoot(document.getElementById('app')).render(<Settings />);