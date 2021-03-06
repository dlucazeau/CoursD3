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

        // Des données d'échelle
        // En x données discrètes par bandes ce qui convient très bien aux barres verticales
        x = d3.scale.ordinal()
                .rangeRoundBands([0, w], 0.3),

        // En y données linéaires qui correspondent à la hauteur des barres
        y = d3.scale.linear()
                .range([h, 0]),
		
		// Les couleurs des barres du graphique
		color = d3.scale.category20(),
    
        // Les axes
        xAxis = d3.svg.axis()
            .scale(x)
            .orient("bottom"),

        yAxis = d3.svg.axis()
            .scale(y)
            .orient("left")
            .ticks(1)
            .tickFormat(""),

        // La grille avec juste les lignes horizontales
        yGrid = d3.svg.axis()
            .scale(y)
            .orient("left")
            .ticks(5)
            .tickSize(-w, 0, 0)
            .tickFormat(d3.format("d")),
        
        title = graph.append("g")
            .attr("class", "title"),

        labels = graph.append("g")
            .attr("class", "labels");

 /* -------------------------------------------------------------------------*/
    title.append("text")
        .attr("x", (w / 2))
        .attr("y", -margin.top / 2)
        .attr("text-anchor", "middle")
        .style("font-size", "22px")
        .text("Suivi des visites de produits");
 /* -------------------------------------------------------------------------*/
    
    // Chargement et manipulation des données
    d3.json("StatsFile.json", function (error, data) {
        // Tout ce qui dépend des données doit être placé dans cette fonction de callback
        
        // Mise en correspondance de l'intervalle des données discrètes avec la place définie par x
        x.domain(data.map(function (d) { return d.Nom; }));
        // Idem mais pour les valeurs continues 
        y.domain([0, d3.max(data, function (d) { return d.NbVis; })]);
        
        graph.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(0," + h + ")")
            .call(xAxis)
            .selectAll("text")
                .style("text-anchor", "end")
                .attr("dx", "-.8em")
                .attr("dy", ".15em")
                .attr("transform", "rotate(-65)");

        graph.append("g")
            .attr("class", "y axis")
            .call(yAxis);

        graph.append("g")
            .attr("class", "grid")
            .call(yGrid);

 /* -------------------------------------------------------------------------*/
        labels.append("text")
            .attr("transform", "rotate(-90)")
            .attr("y", -2 * margin.left / 3)
            .attr("x", -h / 2)
            //.attr("dy", ".100em")
            .style("text-anchor", "middle")
            .text("Nombre de visites");
 /* -------------------------------------------------------------------------*/
        
        graph.selectAll("rect")
            .data(data)
                .enter().append("rect")
                    .attr("x", function (d) { return x(d.Nom); })
                    .attr("width", x.rangeBand())
                    .attr("y", function (d) {return y(d.NbVis); })
                    .attr("height", function (d) { return h - y(d.NbVis); })
                    .attr("fill", function (d) { return color(d.Nom); });
    });
}());