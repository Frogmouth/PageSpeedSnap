'use strict';

import React, {useLayoutEffect, useEffect, useState, createContext, useMemo, useContext} from 'react';
import {Button, Modal, Row, Col, Container, FormCheck} from 'react-bootstrap';
import { createRoot } from 'react-dom/client';

const defaultAppContext = {
    url : null,
    tabid: null,
    pageType: 'idle',
    pageStatus: null,
    dashboardUrl: null,
    pageSpeedTestUrl: "https://pagespeed.web.dev/analysis?url="
};
const AppContext = createContext(null);

const openPage = (url, background) => {
    try{
        const checkUrl = parseUrl(url);
        if(!checkUrl) return false;
        chrome.tabs.create({url: url, active: !background});
    }catch(e){
        console.log(e);
    }
}

const parseUrl = (url) => {
    try {
        return new URL(url);
    }catch(e) {
        console.log(JSON.stringify(url), 'is not a valid url');
        return null;
    }
}

const SniffResult = () => {
    const {url ,pageType, pageStatus, dashboardUrl} = useContext(AppContext);

    const renderPageStatus = () => {
        if(!pageStatus) return (<p>Sniffing data...</p>);
        return (<div>
            <p>{pageStatus.message || 'No data found for this page'}</p>
        </div>);
    }

    const openDashboard = (domain) => {
        if(domain) {
            const parsedUrl = parseUrl(url);
            if(parsedUrl){
                openPage(`${dashboardUrl}?domain=${encodeURIComponent(parsedUrl.hostname)}`);
            } else {
                //notify
            }
            return false;
        }
        openPage(`${dashboardUrl}?url=${encodeURIComponent(url)}`);
    }

    const renderTab = () => {
        switch(pageType) {
            case 'pagespeed' :
                return (<div>{renderPageStatus()}</div>)
            case 'website' :
                return (<div>
                <p>Snapshots for this site:</p>
                <Row>
                    <Col><Button onClick={() => openDashboard()} variant="primary">Page snaps</Button></Col>
                    <Col><Button onClick={() => openDashboard(true)} variant="secondary">Domain snaps</Button></Col>
                </Row>
            </div>)
            case 'other' :
                return (<div>
                <p>Something gone wrong...</p>
                </div>)
        }
        return (<div><p>Loading...</p></div>);
    }
        
    return (
        <div>
            <div>{renderTab()}</div>
        </div>
    )
}
        
const SniffPage = () => { 
    const {url,pageType,pageSpeedTestUrl} = useContext(AppContext);
    const [closeOnTest, setCloseOnTest] = useState(true);

    const startNewTest = (_url, _close) => {
        openPage(pageSpeedTestUrl + _url + '&close=1', true)
    }

    const BulkTest = (props) => {
        const [show, setShow] = useState(false);
        const [text, setText] = useState('');
        const {close} = props;

        const execTests = (close) => {
            if(text) {
                text.split(/\n/g).forEach((testurl) => {
                    startNewTest(testurl, close);
                });
            }
            setShow(false);
        }

        return (<>
            <Button onClick={() => {setShow(true)}} variant='secondary'>Test bulk urls</Button>
                <Modal show={show} onHide={() => {setShow(false)}} fullscreen>
                <Modal.Body className="py-1 px-1">
                    <div className='d-flex w-100 h-100 flex-column'>
                        <div className='flex-grow-0'>
                            <p className='py-1 m-0'>Copy & Paste a list of url, one url per row:</p>
                        </div>
                        <div className='flex-grow-1'>
                            <textarea className='w-100 h-100 bg-light-subtle text-light-emphasis' value={text} onChange={(e) => setText(e.target.value)}></textarea>
                        </div>
                    </div>
                </Modal.Body>

                <Modal.Footer>
                    <Button variant="secondary" onClick={() => {setShow(false)}}>Close</Button>
                    <Button variant="primary" onClick={() => {execTests(close)}}>Start Tests</Button>
                </Modal.Footer>
            </Modal>
        </>);
    }

    const renderSniffComponent = () => {
        switch(pageType) {
            case 'pagespeed' : 
                return (
                    <div>
                        <p>Page Speed Test:</p>
                        {url && <div className="col">
                            <Button onClick={() => startNewTest(url, closeOnTest)} variant="primary">Test Original URL</Button>
                        </div>}
                        <div className="col">
                            <BulkTest close={closeOnTest} />
                        </div>
                        <div className="col-12">
                            <FormCheck checked={closeOnTest} onChange={(e) => setCloseOnTest(e.target.checked)} type="checkbox" label="Close on test end" />
                        </div>
                    </div>
                )
            case 'website' : 
                return (<div>
                    <p>Page Speed Test:</p>
                    <div className="row">
                        <div className="col">
                            <Button onClick={() => startNewTest(url, closeOnTest)} variant="primary">Test current url</Button>
                        </div>
                        <div className="col">
                            <BulkTest close={closeOnTest} />
                        </div>
                        <div className="col-12 mt-2">
                            <FormCheck checked={closeOnTest} onChange={(e) => setCloseOnTest(e.target.checked)} type="checkbox" label="Close on test end" />
                        </div>
                    </div>
                </div>)
        }
        return (
            <div><p>Loading...</p></div>
        )
    }

    return <div>
        {renderSniffComponent()}
    </div>}
            
const Dashboard = () => {
    const [url, setUrl] = useState(defaultAppContext.url);
    const [tabid, setTabid] = useState(defaultAppContext.tabid);
    const [pageType, setPageType] = useState(defaultAppContext.pageType);
    const [pageStatus, setPageStatus] = useState(defaultAppContext.pageStatus);
    const dashboardUrl = chrome.runtime.getURL('dashbaord.html');

    const appState = useMemo(() => {
        return {url, tabid, pageType, pageStatus, dashboardUrl, pageSpeedTestUrl: defaultAppContext.pageSpeedTestUrl};

    }, [url,tabid,pageType,pageStatus])

    useEffect( () => {
        if(url) {
            let urlObj = new URL(url);
            if(urlObj.hostname === "pagespeed.web.dev" && urlObj.pathname.indexOf("analysis") != -1) {
                setPageType('pagespeed');
                const testId = urlObj.pathname.split('/').pop();
                
                if(testId) chrome.runtime.sendMessage(
                    {
                        type: 'QUERY',
                        payload: {
                            id: testId,
                        },
                    },
                    function(response) {
                        setPageStatus(response);
                        if(response?.data?.originalurl) setUrl(response?.data?.originalurl);
                    }
                );
            } else if(urlObj.hostname !== "pagespeed.web.dev") {
                setPageType('website');
            } else {
                setPageType('other');
            }
        }
    }, [url]);
    
    useEffect(() => {
        if(chrome.tabs){
            let hl1 = function() {
                setTimeout(() => {
                    chrome.tabs.query({
                        active: true,
                        currentWindow: true
                    }, function (tabs) {
                        const [activeTab] = tabs;
                        setTabid(activeTab.id);
                        setUrl(activeTab.url);
                        chrome.tabs.sendMessage(activeTab.id, {
                            type: 'PAGE-STATUS',
                        },
                        function (response) {
                            setPageStatus(response);
                            if(response?.data?.originalurl) setUrl(response?.data?.originalurl);
                        });
                    });
                },0)
            }
            document.addEventListener("DOMContentLoaded", hl1);
        }
        return () => {
            document.removeEventListener("DOMContentLoaded", hl1);
        }
    }, []);

    useLayoutEffect(() => {
        let hdl1, hdl2;
        if(chrome.tabs) {
            hdl1 = function(activeInfo){
                setTabid(tabidactiveInfo.tabId);
                chrome.tabs.get(activeInfo.tabId, function(tab){
                    setUrl(tab.url);
                });
            };
            chrome.tabs.onActivated.addListener(hdl1);
            hdl2 = (tabId, change, tab) => {
                if (tab.active && change.url) {
                    setTabid(tabId);
                    setUrl(change.url);
                }
                return true;
            }
            chrome.tabs.onUpdated.addListener(hdl2);
        }
        return () => {
            hdl1 && chrome.tabs.onActivated.removeListener(hdl1);
            hdl2 && chrome.tabs.onUpdated.removeListener(hdl2);
        }
    }, []);

    return (<div className="com_dashboard d-flex justify-content-center align-items-center h-100 w-100">
        <AppContext.Provider value={appState}>
            <Container>
                <Row className="mb-3">
                    <Col>
                        <SniffResult />
                    </Col>
                </Row>
                <hr />
                <Row>
                    <Col>
                        <SniffPage />
                    </Col>
                </Row>
            </Container>
        </AppContext.Provider>
    </div>);
}
                
// Render your React component instead
const root = createRoot(document.getElementById('app'));
root.render(<Dashboard />);