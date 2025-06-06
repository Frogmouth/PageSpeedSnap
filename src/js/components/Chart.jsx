import { VITALSTRASHOLD } from '../constants.ts';

import React, { useMemo } from 'react';

import { Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend, } from "chart.js";

import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
  Legend
);

import { Container } from 'react-bootstrap';

export default function Chart(props) {

    const { sortedSnap, showChart } = props;
    
    /**
     * Generate series for the chart
     */

    const series = useMemo(() => {
        let s = [];
        if(!sortedSnap.length || !showChart) return s;
        s.push({
            id: 'desktop',
            label: `${showChart} - Desktop`,
            data: sortedSnap.map(snap => snap.desktop?.vitals?.metrics[showChart]?.value || null),
            borderColor: 'rgb(255, 103, 242)',
            backgroundColor: 'rgb(255, 103, 242)',
        });

        s.push({
            id: 'mobile',
            label: `${showChart} - Mobile`,
            borderColor: 'rgb(103, 207, 255)',
            backgroundColor: 'rgb(103, 207, 255)',
            data: sortedSnap.map(snap => snap.mobile?.vitals?.metrics[showChart]?.value || null),
        });

        s.push({
            id: 'good',
            label: 'Good',
            borderColor: 'rgba(123, 255, 189, 0.5)',
            backgroundColor: 'rgba(123, 255, 189, 0.5)',
            fill: true,
            data: sortedSnap.map(snap => VITALSTRASHOLD[showChart][0]),
        });

        s.push({
            id: 'average',
            label: 'Average',
            borderColor: 'rgba(237, 255, 123, 0.5)',
            backgroundColor: 'rgba(237, 255, 123, 0.5)',
            fill: true,
            data: sortedSnap.map(snap => VITALSTRASHOLD[showChart][1]),
        });

        return {datasets:s, labels: sortedSnap.map(snap => `${snap.fetchDate.getDate()}/${snap.fetchDate.getMonth() + 1}`)};
    }, [sortedSnap, showChart]);

    return <Container fluid style={{height: 450}} className="mb-2">
        <div style={{height: '100%', width: '100%', margin: '0 auto', position: 'relative'}}>
            <Line options={{
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: 12,
                },
                scales: {
                    x: {
                        reverse: true
                    }
                }
            }} datasetIdKey='id' data={series} />
        </div>
    </Container>;
}