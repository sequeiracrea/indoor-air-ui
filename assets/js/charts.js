// assets/js/charts.js
export function scatterChart(ctx, points) {
    return new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: "Relation",
                data: points
            }]
        }
    });
}

export function lineChart(ctx, values, labels) {
    return new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                data: values
            }]
        }
    });
}

