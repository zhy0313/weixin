/**
 * Created by 重书 on 2016/9/7.
 */
var db = require('../utils/db');
var config = require('../config/app_config');
var sd = require('silly-datetime');
var https = require('https');
var async = require('async');

exports.createOrderInfo = function (data,callback) {
    console.log('info ' + JSON.stringify(data));
    var order_str = data.order_str;
    var userOpenId = data.open_id;

    var time = sd.format(new Date(), 'YYYY/MM/DD/hh:mm');
    var store_id = parseInt(data.store_id || 1);
    var desk_id = parseInt(data.desk_id || 1);
    var order_obj = JSON.parse(data.order_str);
    var price = data.price;
    var string = '';

    if (order_obj != null) {
        for (var i in order_obj) {
            string += order_obj[i].name + "*" + order_obj[i].counter + ";";
        }

        var values_order = [store_id, desk_id, time, userOpenId, 0, price, string];

        var sql_order = 'INSERT INTO od_hdr (od_store_id,od_desk_id,od_date,od_wechatopenid,od_state,od_total_price,od_string) ' +
            'VALUES (?,?,?,?,?,?,?)';
        db.exec(sql_order, values_order, function (err, result) {
            if (err) {
		callback(err);
                return;
            }
            var order_id = result.insertId;
	    callback(null,order_id);
            var j = 0;
            for (var i in order_obj) {
                var sql_food = 'INSERT INTO od_ln (od_id,od_line_number,gd_name,gd_quantity,od_price,gd_id) ' +
                    'VALUES (?,?,?,?,?,?)';
                var food_id = order_obj[i].id;
                var food_name = order_obj[i].name;
                var food_quantity = order_obj[i].counter;
                var food_price = order_obj[i].price;
                var values_food = [order_id, j + 1, food_name, food_quantity, food_price,food_id];
                db.exec(sql_food, values_food, function (err, result) {
                    if (err) {
                        //callback(err);
                        return;
                    } else {
                        console.log("food inserted");
                    }
                });
                ++j;
            }
        });
    }

}

exports.searchOrder = function (req, res, next) {
     var data = req.body;
     var userOpenId = req.session.openid;
    // var openIdCode = data.code;
     var values_order = [userOpenId];
    var sql_order = 'SELECT * FROM od_hdr where od_wechatopenid = ? ';
    db.exec(sql_order, values_order, function (err, result) {
        if (err) {
            //callback(err);
            return;
        }
        //callback(null, result);
        console.log(result);
        var order_detail = {};
        var order_list = [];
        if (result.length > 0) {
            for (var i = 0; i < result.length; ++i) {
                var items = new Array();
                var item_list = [];
                var item_detail = {};
                items = result[i].od_string.split(";");
                for (var j = 0; j < items.length; j++) {
                    var item = items[j].split("*");
                    if (item[0] != null && item[0] != '') {
                        item_detail['name'] = item[0];
                        item_detail['counter'] = item[1];
                        item_list.push(item_detail);
                        item_detail = {};
                    }

                }
                order_detail['id'] = result[i].od_id;
                order_detail['date'] = sd.format(result[i].od_date, 'YYYY/MM/DD/hh:mm');
                order_detail['items'] = item_list;
                order_detail['price'] = result[i].od_total_price;
                order_detail['state'] = result[i].od_state;
                order_list.push(order_detail);
                order_detail = {};
            }
        }
        var a = {};
        a.arr = order_list;
        console.log(a.arr);
        res.render('order', a);

    });
}
exports.order = function (req, res, next) {
    var data = req.body;
    var userOpenId = req.session.openid;
    var values_order = [userOpenId];
    var sql_order = 'SELECT * FROM od_hdr where od_wechatopenid = ? ';
    db.exec(sql_order, values_order, function (err, result) {
        if (err) {
            //callback(err);
            return;
        }
        //callback(null, result);
        console.log(result);
        var order_detail = {};
        var order_list = [];
        if (result.length > 0) {
            for (var i = 0; i < result.length; ++i) {
                var items = new Array();
                var item_list = [];
                var item_detail = {};
                items = result[i].od_string.split(";");
                for (var j = 0; j < items.length; j++) {
                    var item = items[j].split("*");
                    if (item[0] != null && item[0] != '') {
                        item_detail['name'] = item[0];
                        item_detail['counter'] = item[1];
                        item_list.push(item_detail);
                        item_detail = {};
                    }

                }
                order_detail['id'] = result[i].od_id;
                order_detail['date'] = result[i].od_date;
                order_detail['items'] = item_list;
                order_detail['price'] = result[i].od_total_price;
                order_detail['state'] = result[i].od_state;
                order_list.push(order_detail);
                order_detail = {};
            }
        }
        var a = {};
        a.arr = order_list;
        //res.render('order',order_list);
        res.json(order_list)
    });
}

exports.updateOrder = function (req) {    // ***** 定义 0为未支付，1为支付成功，未完待续 *******
    var jsonSet = req;
    var orderId = jsonSet.data.object.order_no || 123;
    // var openIdCode = data.code;
    var values_order = [orderId];
    var sql_order = 'UPDATE od_hdr SET od_state = 1 where od_id = ? ';
    var sql_get_items =  'SELECT gd_id,gd_quantity FROM od_ln where od_id = ? ';
    var sql_update_inventory = 'UPDATE gd_mst SET gd_inventory = gd_inventory - ? where gd_id = ? ';
    async.series({
            // update
            step_update: function(callback) {
                db.exec(sql_order, values_order, function (err, result) {
                    if (err) {
                        //callback(err);
                        console.log(err);
                        return;
                    }
                    //callback(null, result);
                });
                callback(null, 'update order successfully');
            },
            // get items
            step_get:function(callback) {
                db.exec(sql_get_items, values_order, function (err, result) {
                    if (err) {
                        console.log(err);
                        return;
                    }
                    //callback(null, result);
                    console.log(result);
                    //var item_detail = {};
                    //var item_list = [];
                    if (result.length > 0) {
                        var item_list = [];
                        var item_detail = {};
                        for (var i = 0; i < result.length; ++i) {

                            item_detail['id'] = result[i].gd_id;
                            item_detail['quantity'] = result[i].gd_quantity;

                            item_list.push(item_detail);
                            item_detail = {};
                        }
                        callback(null, item_list);
                    }

                });

            }
        },
        function(err, results) {
            // update inventory in parallel
            var item_list = results.step_get;
            if(item_list.length > 0){
                async.each(item_list, function(item, callback) {
                    var values_item = [item.quantity,item.id];
                    db.exec(sql_update_inventory, values_item, function (err, result) {
                        if (err) {
                            console.log(err);
                            return;
                        }
                        //callback(null, result);
                        console.log(result);

                    });
                }, function(err) {
                    log('1.1 err: ' + err);
                    return;
                });

            }
        });

}
