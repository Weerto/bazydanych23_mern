const express = require("express");
const recordRoutes = express.Router();
const dbo = require("../db/conn");
const ObjectId = require("mongodb").ObjectId;

// get all products OR use query params
recordRoutes.route("/products").get(function(req, res) {
    let db_connect = dbo.getDb("test");
    let query = {};
    let sortOptions = {};

    // filtering
    const filterParams = ['name', 'price', 'description', 'amount', 'unit'];
    filterParams.forEach(param => {
        if (req.query[param]) {
            query[param] = req.query[param];
        }
    });

    // sorting
    if (req.query.sortBy) {
        sortOptions[req.query.sortBy] = (req.query.sortOrder == -1) ? -1 : 1;
    }

    db_connect.collection("products").find(query).sort(sortOptions).toArray(function(err, result) {
        if (err) throw err;
        res.json(result);
    });
});

// get product by id
recordRoutes.route("/products/:id").get(function(req, response) {
    let db_connect = dbo.getDb("test");
    let myquery = {_id: ObjectId(req.params.id)};
    db_connect.collection("products").findOne(myquery, function(err, result){
        if (err) throw err;
        response.json(result);
    });
});

// adding a new product
recordRoutes.route("/products").post(function(req, response){
    let db_connect = dbo.getDb("test");
    let myobj = {
        name: req.body.name,
        price: req.body.price,
        description: req.body.description,
        amount: req.body.amount,
        unit: req.body.unit
    };
   
    // try to find if the product already exists - if it doesn't, add
    db_connect.collection("products").findOne({name: myobj.name}, function(err, existingProduct){
        if (err) throw err;
        if (!existingProduct) {
            db_connect.collection("products").insertOne(myobj, function(error, res){
                if(error) throw error;
                response.json(res)
            });
        } else {
            response.status(400).json({error: "Product with the same name already exists!"})
        }
    });
});

//updating
recordRoutes.route("/products/:id").put(function(req, response){
    let db_connect = dbo.getDb("test");
    let myquery = {_id: ObjectId(req.params.id)};
    let newValues = {$set: {}}
    const updateParams = ['name', 'price', 'description', 'amount', 'unit'];
    updateParams.forEach(param => {
        if (req.body[param]) {
            newValues.$set[param] = req.body[param];
        }
    });
    db_connect.collection("products").updateOne(myquery, newValues, function(err, res){
        if (err) throw err;
        console.log("1 document updated successfully");
        response.json(res);
    });
});

// deleting
recordRoutes.route("/products/:id").delete(function(req, response){
    let db_connect = dbo.getDb("test");
    let myquery = {_id: ObjectId(req.params.id)};
    db_connect.collection("products").deleteOne(myquery, function(err, obj) {
        if (obj.deletedCount === 0) {
            console.log("Error - couldn't delete.");
        } else if (err) {
            throw err;
        } else {
            console.log(`Documents deleted successfully: ${obj.deletedCount}`);
        }
        response.json(obj);
    })
})

// reporting
recordRoutes.route("/report").get(function(req, response){
    let db_connect = dbo.getDb("test");

    //report all products if no parameters are given
    let selectedProducts = req.query.products ? req.query.products.split(",") : [];
    const query = selectedProducts.length > 0 ? {name: {$in: selectedProducts}} : {};

    //aggregation pipeline
    const aggregationPipeline = [
        {$match: query},
        {$project: {
            name: 1,
            stock: {$concat: [{$toString: "$amount"}," ", "$unit"]},
            'in-stock value': {$multiply: ["$amount", "$price"]},
        }},
        {$group: {
            _id: null,
            products: {$push: "$$ROOT"},
            selectedProductsValue: {$sum: "$in-stock value"}
        }},
        {$project: {
            _id: 0
        }}
    ];
    db_connect.collection("products").aggregate(aggregationPipeline).toArray(function(err, result){
        if (err) throw err;
        response.json(result);
    })
    
});

module.exports = recordRoutes;