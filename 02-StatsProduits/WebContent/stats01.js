(function () {
    "use strict";
	/*global d3*/
    
    // Constantes du graphe
    var width = 800,
        height = 500,
        margin = {top: 70, right: 40, bottom: 70, left: 40},
        w = width - margin.left - margin.right,
        h = height - margin.top - margin.bottom,

        // Définition de la zone du graphique
        svg = d3.select("#graph")
                    .append("svg")
                        .attr("width", width)
                        .attr("height", height),
        
        graph = svg.append("g")
                    .attr("transform", "translate(" + margin.left + ", " + margin.top + ")");
        
    // Chargement et manipulation des données
    d3.json("StatsFile.json", function (error, data) {
        // Tout ce qui dépend des données doit être placé dans cette fonction de callback
        graph.selectAll("rect")
            .data(data)
                .enter().append("rect");
    });
}());