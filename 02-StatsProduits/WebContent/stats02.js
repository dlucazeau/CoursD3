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
                    .attr("transform", "translate(" + margin.left + ", " + margin.top + ")"),

 /* -------------------------------------------------------------------------*/
        // Des données d'échelle
        // En x données discrètes par bandes ce qui convient très bien aux barres verticales
        x = d3.scale.ordinal()
                .rangeRoundBands([0, w], 0.3),

        // En y données linéaires qui correspondent à la hauteur des barres
        y = d3.scale.linear()
                .range([h, 0]);
 /* -------------------------------------------------------------------------*/
    
    // Chargement et manipulation des données
    d3.json("StatsFile.json", function (error, data) {
        // Tout ce qui dépend des données doit être placé dans cette fonction de callback
        
        // Mise en correspondance de l'intervalle des données discrètes avec la place définie par x
        x.domain(data.map(function (d) { return d.Nom; }));
        // Idem mais pour les valeurs continues 
        y.domain([0, d3.max(data, function (d) { return d.NbVis; })]);
        graph.selectAll("rect")
            .data(data)
                .enter().append("rect")
 /* -------------------------------------------------------------------------*/
                    .attr("x", function (d) { return x(d.Nom); })
                    .attr("width", x.rangeBand())
                    .attr("y", function (d) {return y(d.NbVis); })
                    .attr("height", function (d) { return h - y(d.NbVis); });
 /* -------------------------------------------------------------------------*/
    });
}());