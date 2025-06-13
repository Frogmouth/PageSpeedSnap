'use strict';

import React, {useEffect, useState, useMemo, Fragment, Suspense, useCallback} from 'react';
import { Table, Badge, Container, Navbar, Spinner, Offcanvas, Button, ToggleButton, FormCheck, DropdownButton, Dropdown, Alert, Form } from 'react-bootstrap';
import { createRoot } from 'react-dom/client';
import { useLiveQuery } from "dexie-react-hooks";

import {OBJECTNAME, VITALSID } from './constants.ts';
import db, { snaps } from './helpers/db.jsx';

const Chart = React.lazy(() => import('./components/Chart.jsx'));

const pageSpeedTestUrl = "https://pagespeed.web.dev/analysis";
const visTestUrl = "https://cruxvis.withgoogle.com/#/?url=";

function onlyUnique(value, index, array) {
    return array.findIndex((val) => val.toString() === value.toString()) === index;
}

const openPage = (url, background) => {
    try{
        chrome.tabs.create({url: url, active: !background});
    }catch(e){
        console.log(e);
    }
}

const checkFilter = (filters, item) => {
    if(!filters.length) return true;
    return filters.every((filter) => {
        if(filter.id === 'fetchDate') {
            return item.fetchDate.getTime() === filter.value.getTime();
        }
        if(filter.id === 'originalurl') {
            return item.originalurl === filter.value;
        }
        if(filter.id === 'domain') {
            return item.domain === filter.value;
        }
        return true;
    });
}

const Dashboard = () => {

    const today = new Date();
    const last30Days = new Date();

    last30Days.setDate(today.getDate() - 30);

    const [filters, setFilters] = useState([]);
    const [showFor, setShowFor] = useState(null);
    const [domain, setDomain] = useState(null);
    const [fetchDate, setFetchDate] = useState(null);
    const [url, setUrl] = useState(null);
    const [showChart, setShowChart] = useState(null);
    const snapsList = useLiveQuery(() => snaps.where('fetchDate').above(last30Days).toArray(), [url,domain,fetchDate]);

    const [showPerformance, setShowPerformance] = useState(false);
    const [selectedItems, setSelectedItems] = useState([]);
    const [groupBy, setGroupBy] = useState(null);

    const sortedSnap = useMemo(() => {
        let newSnap = snapsList || []
        if(newSnap.length < 2) return newSnap;
        let newFilterd;
        if(filters.length) {
            newFilterd = newSnap.filter((item) => {
                return checkFilter(filters, item);
            })
        }

        let orderedList = (newFilterd || newSnap).map((item) => {
            const dateTime = new Date(item.desktop.fetchTime);
            dateTime.setHours(0);
            dateTime.setMinutes(0);
            dateTime.setSeconds(0);
            dateTime.setMilliseconds(0);
            item.fetchDate = dateTime;
            return item;
        }).sort(function(a,b){
            return b.fetchDate - a.fetchDate;
        });

        let result;
        if(groupBy) {
            result = orderedList.map((groups => o => {
                if (groups[o[groupBy].toString()]) {
                    groups[o[groupBy].toString()].push(o);
                    return [];
                }
                return groups[o[groupBy].toString()] = [o];
            })({})).flat();
        } else {
            result = orderedList;
        }

        return result;
    }, [snapsList, filters, groupBy]);

    const domainsFilter = useMemo(() => (snapsList||[]).map((snap) => snap.domain).filter(onlyUnique), [snapsList]);
    const urlsFilter = useMemo(() => (snapsList||[]).map((snap) => snap.originalurl).filter(onlyUnique), [snapsList]);
    const dateFilter = useMemo(() => (sortedSnap||[]).map((snap) => snap.fetchDate).sort(function(a,b) {
        return b.fetchDate - a.fetchDate;
    }).filter(onlyUnique), [sortedSnap]);

    /**
     * Effects
     */

    useEffect(() => {
        setSelectedItems([]);
    }, [sortedSnap])

    useEffect(() => {
        const queryParameters = new URLSearchParams(window.location.search);
        const filters = [];
        const url = queryParameters.get("url");
        const domain = queryParameters.get("domain");
        const groupby = queryParameters.get("group");

        if(url) {
            filters.push({id: 'originalurl', value: url, label: 'Url', static: true});
        }
        if(domain) {
            filters.push({id: 'domain', value: domain, label: 'Domain', static: true});
        }

        if(filters.length) {    
            setFilters(filters);
        }

        if(groupby) {
            setGroupBy(groupby);
        }

        setShowFor(url && 'url' || domain && 'domain' || 'unselected');

    }, []);

    /**
     * Methods
     */

    const toggleSelection = function (checked, id) {
        if(checked) {
            setSelectedItems([...selectedItems, id]);
        } else {
            setSelectedItems(selectedItems.filter((item) => item !== id));
        }
    }

    const toggleSelectAll = function (event) {
        const checked = event.target.checked;
        if(checked) {
            setTimeout(() => setSelectedItems(sortedSnap.map((item) => item.id), 0));
        } else {
            setSelectedItems([]);
        }   
    }
    
    const deleteItem = function (id) {
        const transaction = db.transaction(OBJECTNAME, "readwrite");
        const objRequest = transaction.objectStore(OBJECTNAME);

        objRequest.delete(id);

        transaction.oncomplete = () => {
            console.log("SNAP delete");    snapsList.filter((snap) => snap.useLiveQuery(() => {
                
            }));
        }
    }

    const copyBulk = function (itemsid, key) {
        if(key === 'id') {
            copyText(itemsid.join('\n'));
            return;
        }

        const text = itemsid.map((itemid) => {
            // using id only
            if(key === 'snap_url') {
                return `${pageSpeedTestUrl}/${itemid}`;
            }

            // using item object properties
            const item = snapsList.find((snap) => snap.id === itemid);
            if(key === 'vis_url') {
                return `${visTestUrl}${encodeURIComponent(item.originalurl)}`;
            }
            return item[key];
        }).join('\n');

        copyText(text);
    }

    const copyText = function (text) {
        navigator.clipboard.writeText(text).then(() => {
            console.log('Text copied to clipboard');
        }, (err) => {
            console.log(err);
        });
    }

    /* renders */

    const vitalsMetricsDisplay = function(vitals) {
        const badgeVariant = vitals.assessment === 'average' ? 'warning' : vitals.assessment === 'good' ? 'success' : 'danger';
        const naValue = vitals.value === null;
        return <div>
            <Badge pill text={naValue && 'dark' || null} bg={ naValue && 'light' || badgeVariant} title={naValue && vitals.display || null}>{vitals.value && vitals.display || 'N/A'}</Badge>
            <div className='d-flex gap-1 justify-content-center' style={{fontSize: '60%'}}>{vitals.percentages?.map((p,i) => <span key={i}>{p.displayValue}</span>) || '-% -% -%'}</div>
        </div>
    }

    const performMetricsDisplay = function(ref) {
        const {numericValue,numericUnit, scoringOptions, displayValue} = ref;
        const badgeVariant = numericValue <= scoringOptions.p10 ? 'success' : numericValue <= scoringOptions.median ? 'warning' : 'danger';
        return <Badge pill bg={badgeVariant} title={`${numericValue} ${numericUnit}`}>{displayValue}</Badge>
    }

    const padZero = function (n) {
        return (n+"").padStart(2, '0');
    }

    const displayDate = function(date) {
        const d = date;
        return (<span title={d}>{`${padZero(d.getDate())}/${padZero(d.getMonth()+1)}`}</span>);
    }

    const display = function (value) {
        if (value && value.getDate) {
            return displayDate(value);
        }
        return value.toString();
    }

    const toggleFilter = function (event, id, value, label) {
        if(event.target.checked) {
            const tempFilter = [...filters].filter((val) => val.id !== id);
            setFilters([...tempFilter,{id, value, label}])
        } else {
            removeFilter(id, value);
        }
    }

    const removeFilter = function (id, value) {
        const tempFilter = [...filters].filter((val) => val.id !== id && val.value !== value);
        setFilters([...tempFilter])
    }

    const RenderTable = () => {
        let raowGroup = null;
        return (<Table striped responsive hover className='align-middle'>
            <thead>
                <tr>
                    <th className='align-middle text-center' rowSpan={2}>
                        <DropdownButton disabled={!selectedItems.length} size='sm' variant="primary" id="dropdown-all-menu" title={<i className="bi bi-gear-fill"></i>}>
                            <Dropdown.Item title="Create new sneps" onClick={() => {
                                selectedItems.forEach((id) => {
                                    const snap = snapsList.find((snap) => snap.id === id);
                                    openPage(`${pageSpeedTestUrl}?close=1&url=${snap.originalurl}`, true);
                                })}}>New sneps</Dropdown.Item>
                            <Dropdown.Item title="Open all urls" onClick={() => {
                                selectedItems.forEach((id) => {
                                    openPage(`${pageSpeedTestUrl}/${id}`);
                                })
                            }}>Open snapsList</Dropdown.Item>
                            <Dropdown.Divider />
                            <Dropdown.Item title="Copy insight" onClick={() => copyBulk(selectedItems, 'snap_url')}>Copy Pagespeed urls</Dropdown.Item>
                            <Dropdown.Item title="Open all urls" onClick={() => copyBulk(selectedItems, 'originalurl')}>Copy original urls</Dropdown.Item>
                            <Dropdown.Item title="Open all vis" onClick={() => copyBulk(selectedItems, 'vis_url')}>Copy VIS urls</Dropdown.Item>
                            <Dropdown.Divider />
                            <Dropdown.Item title="Delete selected" onClick={() => alert('DO NOTHING FOR NOW...')} className='text-danger'><i className='bi bi-trash'></i> Delete selected ({selectedItems.length})</Dropdown.Item>
                        </DropdownButton>
                    </th>
                    <th className='align-middle text-center' rowSpan={2}>
                        <FormCheck name="select-all" aria-label='select all' checked={selectedItems.length === sortedSnap.length} onChange={toggleSelectAll} />
                    </th>
                    <th className='align-middle' rowSpan={2}>{'#'}</th>
                    <th className='align-middle' rowSpan={2}>Date</th>
                    <th className='align-middle' rowSpan={2}>URL</th>
                    {/* <th rowSpan={2}>Conflict</th> */}
                    <th className='text-center align-middle bg-light' rowSpan={2}><i className="bi bi-bar-chart-line-fill"></i></th>
                    {!showPerformance && <th colSpan={5} className="text-center"><i className="bi bi-laptop" style={{fontSize: "1.4rem"}}></i> Vitals</th>}
                    {showPerformance && <th colSpan={5} className="text-center"><i className="bi bi-laptop" style={{fontSize: "1.4rem"}}></i> Performance</th>}
                    <th className='text-center align-middle bg-light' rowSpan={2}><i className="bi bi-bar-chart-line-fill"></i></th>
                    {!showPerformance && <th colSpan={5} className="text-center"><i className="bi bi-phone" style={{fontSize: "1.4rem"}}></i> Vitals</th>}
                    {showPerformance && <th colSpan={5} className="text-center"><i className="bi bi-phone" style={{fontSize: "1.4rem"}}></i> Performance</th>}
                </tr>
                <tr>
                    {!showPerformance && VITALSID.map((key) => <th key={key} className='text-center'>{key}</th>)}
                    {!showPerformance && VITALSID.map((key) => <th key={key} className='text-center'>{key}</th>)}
                    {showPerformance && sortedSnap[0].desktop?.categories?.performance?.auditRefs?.filter((ref) => ref.group === 'metrics' && !!ref.acronym ).map((ref) => <th key={ref.id} className='text-center'>{ref.acronym}</th>)}
                    {showPerformance && sortedSnap[0].desktop?.categories?.performance?.auditRefs?.filter((ref) => ref.group === 'metrics' && !!ref.acronym ).map((ref) => <th key={ref.id} className='text-center'>{ref.acronym}</th>)}
                </tr>
            </thead>
            <tbody>
                {sortedSnap.map((item, i) => {
                    let addHeading = false;
                    if(groupBy && raowGroup !== item[groupBy].toString()) {
                        addHeading = true;
                        raowGroup = item[groupBy].toString();
                    }
                    return (
                        <Fragment key={item.id}>
                            {addHeading && <tr>
                                <td colSpan="100%" className='bg-info-subtle text-info-emphasis'>{display(item[groupBy]) || `no-${groupBy}`}</td>
                            </tr> || null}
                            <tr key={item.id}>
                                <td className='border text-center'>
                                    <DropdownButton size='sm' variant="light" id="dropdown-menu-align-end" title={<i className="bi bi-gear-fill"></i>}>
                                        <Dropdown.Item target='_blank' title={`Original: ${item.originalurl}`} href={item.originalurl}>Open url</Dropdown.Item>
                                        <Dropdown.Item target='_blank' title="PageSpeed SANP" href={`${pageSpeedTestUrl}/${item.id}`}>Page Speed snap</Dropdown.Item>
                                        <Dropdown.Item target='_blank' title="Vis Report" href={`${visTestUrl}${encodeURIComponent(item.originalurl)}`}>VIS Report</Dropdown.Item>
                                        <Dropdown.Divider />
                                        <Dropdown.Item title="Delete record" onClick={() => deleteItem(item.id)} className='text-danger'><i className='bi bi-trash'></i> Delete</Dropdown.Item>
                                    </DropdownButton>
                                </td>
                                <td className='border text-center'>
                                    <FormCheck name="select" checked={selectedItems.indexOf(item.id) >= 0} onChange={(e) => toggleSelection(e.target.checked, item.id)} />
                                </td>
                                <td className={item.state !== 'completed' && 'table-danger' || null}>{i}</td>
                                <td>{display(item.fetchDate)}</td>
                                <td><a href={`?url=${encodeURIComponent(item.originalurl)}`} title="view url data"><small>{new URL(item.originalurl).pathname}</small></a></td>
                                {/* <td>{item.desktopSnifferVersion !== item.mobileSnifferVersion ? <Badge title={`${item.desktopSnifferVersion} ${item.mobileSnifferVersion}`} pill bg="danger">YES</Badge> : <Badge pill bg="success">NO</Badge>}</td> */}
                                <td className='text-center'>{Math.ceil(item.desktop?.categories?.performance?.score * 100) || '-'}</td>
                                {!showPerformance && item.desktop?.vitals?.metrics && VITALSID.map((key) => <td key={key} className={[item.desktop?.vitals?.general === 'Failed' ? 'bg-danger-subtle' : 'bg-success-subtle', 'text-center vital-metric'].join(' ')}>
                                    {item.desktop.vitals.metrics[key] ? vitalsMetricsDisplay(item.desktop.vitals.metrics[key], item.desktop?.vitals?.general) : '-'}
                                </td>)}
                                {showPerformance && item.desktop?.categories?.performance?.auditRefs?.filter((ref) => ref.group === 'metrics' && !!ref.acronym ).map((ref) => {
                                    const metric = item.desktop.audits?.[ref.id];
                                    return <td key={ref.id} className="text-center">
                                        {performMetricsDisplay(metric)}
                                    </td>
                                })}
                                <td className='text-center'>{Math.ceil(item.mobile?.categories?.performance?.score * 100) || '-'}</td>
                                {!showPerformance && item.mobile?.vitals?.metrics && VITALSID.map((key) => <td key={key} className={[item.mobile?.vitals?.general === 'Failed' ? 'bg-danger-subtle' : 'bg-success-subtle', 'text-center vital-metric'].join(' ')}>
                                    {item.mobile.vitals.metrics[key] ? vitalsMetricsDisplay(item.mobile.vitals.metrics[key]) : '-'}
                                </td>)}
                                {showPerformance && item.mobile?.categories?.performance?.auditRefs?.filter((ref) => ref.group === 'metrics' && !!ref.acronym ).map((ref) => {
                                    const metric = item.mobile.audits?.[ref.id];
                                    return <td key={ref.id} className="text-center">
                                        {performMetricsDisplay(metric)}
                                    </td>
                                })}
                            </tr>
                        </Fragment>
                    )
                })}
            </tbody>
        </Table>)
    }

    const filterLabel = (value) => {
        if(value.setHours) {
            return <>{`${padZero(value.getDate())}/${padZero(value.getMonth()+1)}/${padZero(value.getFullYear())}`}</>
        }
        return `${value.substring(0,50)}${value.length > 50 ? '...' : ''}`;
    }

    const RenderFilters = (props) => {
        const {filters, groups} = props;
        const [show, setShow] = useState(false);

        const handleClose = () => {
            setShow(false);
        }
        return <>
            <Button onClick={() => setShow(true)}><i className="bi bi-filter"></i></Button>
            <Offcanvas show={show} onHide={handleClose} placement="end">
                <Offcanvas.Header closeButton className='border-bottom bg-light-subtle'>
                    <Offcanvas.Title>{'Refinements'}</Offcanvas.Title>
                </Offcanvas.Header>
                <Offcanvas.Body>
                    <h5 className='mb-2'>Group by</h5>
                    <ul className="list-group mb-2">
                        {groups.map((group) => <li key={group.field} className="list-group-item">
                            <FormCheck
                                title={group.field}
                                name={`filter-${group.field}`}
                                id={`filter-${group.field}`}
                                type='radio'
                                disabled={group.disabled}
                                checked={group.field === groupBy}
                                onChange={(e) => {
                                    !e.target.checked ? setGroupBy(null) : setGroupBy(group.field);
                                }}
                                label={group.label} />
                        </li>)}
                    </ul>
                    <h5 className='mb-2'>Filters</h5>
                    <ul className="list-group">
                        {filters.map((filter) => <li key={filter.id} className="list-group-item">
                            <h6 className='pb-3 mb-3 mt-2 border-bottom text-primary'>{filter.label}</h6>
                            <ul className="list-inline">
                                {filter.values.map((value, i) => <li key={i} className={`list-inline-item text-nowrap overflow-hidden ${filter.type === 'date' ? 'w-50 m-0' : 'w-100'}`}>
                                    <FormCheck
                                        title={value}
                                        name={`filter-${filter.id}`}
                                        id={`filter-${filter.id}-${i}`}
                                        type='radio'
                                        disabled={filter.static || filter.values.length === 1}
                                        checked={filter.values.length === 1 || filters.find((val) => val.id === filter.field && val.value === value)}
                                        onChange={(e) => toggleFilter(e, filter.field, value, filter.label)}
                                        label={filterLabel(value)} />
                                    </li>)}
                            </ul>
                        </li>)}
                    </ul>
                </Offcanvas.Body>
            </Offcanvas>
        </>;
    }

    const RenderNav = () => {
        return (<Navbar expand="lg" className="bg-body-tertiary">
            <Container fluid>
                <Navbar.Brand>PageSpeed SNAP - <small>Dashbaord</small></Navbar.Brand>
            </Container>
        </Navbar>)
    }

    return (<>
        <RenderNav />
        {showFor != 'unselected' ?
            <>
                <Container fluid className="d-flex sticky-top gap-1 align-items-center px-3 mb-2 bg-light-subtle text-info-emphasis justify-content-between border-bottom border-top">
                    <div className="py-2 d-flex gap-2 align-items-center">
                        {showFor === 'url' && domain && <Button target='_blank' href={`?domain=${encodeURIComponent(domain)}`} className='text-decoration-none' variant='link'><i className="bi bi-arrow-90deg-up"></i> Domain</Button> || null}
                        {sortedSnap.length && <span>{sortedSnap.length} / {(snapsList||[]).length}</span> || null}
                        {selectedItems.length > 0 && <div className='py-1 px-2 text-bold rounded border'>{selectedItems.length} Selected</div> || null}
                        {filters.length && <div className="d-flex gap-1 py-1">
                            {filters.map((filter) => <Badge key={filter.id} className="text-uppercase" style={{whiteSpace: 'nowrap', cursor: !filter.static ? 'pointer' : null}} onClick={() => !filter.static && removeFilter(filter.id, filter.value)} title={filter.value}>{!filter.static && 'x ' || '' }{filter.label}: {filterLabel(filter.value)}</Badge>)}
                        </div> || null}
                    </div>
                    <div className='d-flex gap-1 align-items-center'>
                        <div className="d-flex gap-1 align-items-center border-start py-2 ps-2">
                            <ToggleButton
                                variant='outline-primary'
                                onChange={(e) => {
                                    setShowPerformance(e.target.checked);
                                }}
                                type="checkbox"
                                checked={showPerformance}
                                id="metric-switcher"
                            >Show Performance</ToggleButton>
                            <DropdownButton variant={showChart ? 'primary' : 'outline-primary'} id="dropdown-chart" title={showChart || 'Charts'} className='ms-2'>
                                <Dropdown.Item active={showChart === null} onClick={() => setTimeout(() => setShowChart(null),0)} title="Hide charts">Hide charts</Dropdown.Item>
                                <Dropdown.Divider />
                                {VITALSID.map((key) => <Dropdown.Item active={showChart === key} key={key} onClick={() => setShowChart(key)} title={`Show ${key} chart`}>{key}</Dropdown.Item>)}
                            </DropdownButton>
                        </div>
                        <div className='d-flex gap-1 align-items-center border-start py-2 ps-2'>
                            <RenderFilters filters={[
                                {id: "domainsFilter", values: domainsFilter, field: 'domain', label: 'Domains'},
                                {id: "urlsFilter", values: urlsFilter, field: 'originalurl', label: 'Urls'},
                                {id: "dateFilter", values: dateFilter, field: 'fetchDate', label: 'Date', type: 'date'},
                            ]}
                            groups={[
                                {field: 'domain', label: 'Domains', disabled: domainsFilter.length === 1},
                                {field: 'originalurl', label: 'Urls', disabled: urlsFilter.length === 1},
                                {field: 'fetchDate', label: 'Date', disabled: dateFilter.length === 1},
                            ]}
                            />
                        </div>
                    </div>
                </Container>
                {showChart && <Suspense fallback="Charts loading...">
                    <Chart sortedSnap={sortedSnap} showChart={showChart} />
                </Suspense>}
                <Container fluid>
                    {!snapsList ? <div className="d-flex justify-content-center align-items-center w-100" style={{height:450}}>
                        {snapsList !== null ? <Alert key="info" variant="info">No snapShot found.</Alert> : <Spinner animation="grow" /> }
                    </div> : <RenderTable />}
                </Container>
            </>
            :
            <>
                <Container className="h-100 d-flex justify-content-center align-items-center">
                    <div>
                        <Alert key="info" variant="info">Select a URL or Domain to see the snapshotsList</Alert>
                        <div>
                            <Form>
                                <Form.Label>Search a term:</Form.Label>
                                <Form.Control name="domain" />
                                <Form.Text muted>
                                    Add a domain to search for (ex. <code>example.com</code>)
                                </Form.Text>
                                <div>
                                    <Button type='submit' className='mt-2'>Search</Button>
                                </div>
                            </Form>
                        </div>
                    </div>
                </Container>
            </>}
    </>)
}

// Render your React component instead
const root = createRoot(document.getElementById('app'));
root.render(<Dashboard />);