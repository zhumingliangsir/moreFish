/**
 * Created by bjwsl-001 on 2017/4/13.
 */

var app = angular.module('kaifanla', ['ionic']);

app.factory('$debounce', ['$rootScope', '$browser', '$q', '$exceptionHandler',
    function ($rootScope, $browser, $q, $exceptionHandler) {
        var deferreds = {},
            methods = {},
            uuid = 0;

        function debounce(fn, delay, invokeApply) {
            var deferred = $q.defer(),
                promise = deferred.promise,
                skipApply = (angular.isDefined(invokeApply) && !invokeApply),
                timeoutId, cleanup,
                methodId, bouncing = false;

            // check we dont have this method already registered
            angular.forEach(methods, function (value, key) {
                if (angular.equals(methods[key].fn, fn)) {
                    bouncing = true;
                    methodId = key;
                }
            });

            // not bouncing, then register new instance
            if (!bouncing) {
                methodId = uuid++;
                methods[methodId] = {fn: fn};
            } else {
                // clear the old timeout
                deferreds[methods[methodId].timeoutId].reject('bounced');
                $browser.defer.cancel(methods[methodId].timeoutId);
            }

            var debounced = function () {
                // actually executing? clean method bank
                delete methods[methodId];

                try {
                    deferred.resolve(fn());
                } catch (e) {
                    deferred.reject(e);
                    $exceptionHandler(e);
                }

                if (!skipApply) $rootScope.$apply();
            };

            timeoutId = $browser.defer(debounced, delay);

            // track id with method
            methods[methodId].timeoutId = timeoutId;

            cleanup = function (reason) {
                delete deferreds[promise.$$timeoutId];
            };

            promise.$$timeoutId = timeoutId;
            deferreds[timeoutId] = deferred;
            promise.then(cleanup, cleanup);

            return promise;
        }


        // similar to angular's $timeout cancel
        debounce.cancel = function (promise) {
            if (promise && promise.$$timeoutId in deferreds) {
                deferreds[promise.$$timeoutId].reject('canceled');
                return $browser.defer.cancel(promise.$$timeoutId);
            }
            return false;
        };

        return debounce;
    }
]);

//自定义服务
app.service('$customHttp', ['$http', '$ionicLoading',
    function ($http, $ionicLoading) {
        this.get = function (url, handleSucc) {

            $ionicLoading.show({
                template: 'loading...'
            })

            $http
                .get(url)
                .success(function (data) {
                    $ionicLoading.hide();
                    handleSucc(data);
                })
        }
    }])


//配置状态
app.config(function ($stateProvider, $urlRouterProvider, $ionicConfigProvider) {
    //将tab选项卡固定在底部
    $ionicConfigProvider.tabs.position('bottom');
    $stateProvider
        .state('start', {
            url: '/kflStart',
            templateUrl: 'tpl/start.html'
        })
        .state('main', {
            url: '/kflMain',
            templateUrl: 'tpl/main.html',
            controller: 'mainCtrl'
        })
        .state('detail', {
            url: '/kflDetail/:id',
            templateUrl: 'tpl/detail.html',
            controller: 'detailCtrl'
        })
        .state('order', {
            url: '/kflOrder/:cartDetail',
            templateUrl: 'tpl/order.html',
            controller: 'orderCtrl'
        })
        .state('myOrder', {
            url: '/kflMyOrder',
            templateUrl: 'tpl/myOrder.html',
            controller: 'myOrderCtrl'
        })
        .state('setting', {
            url: '/kflSetting',
            templateUrl: 'tpl/settings.html',
            controller: 'settingCtrl'
        }).state('cart', {
            url: '/kflCart',
            templateUrl: 'tpl/cart.html',
            controller: 'cartCtrl'
        });

    $urlRouterProvider.otherwise('/kflStart');
})


app.controller('parentCtrl', ['$scope', '$state',
    function ($scope, $state) {
        $scope.jump = function (desState, argument) {
            $state.go(desState, argument);
        }
        $scope.data = {totalNumInCart: 0};
    }]);


app.controller('mainCtrl',
    ['$scope', '$customHttp', '$debounce',
        function ($scope, $customHttp, $debounce) {

            $scope.hasMore = true;
            $scope.inputTxt = {kw: ''};

            $customHttp.get(
                'data/dish_getbypage.php',
                function (data) {
                    //console.log(data);
                    $scope.dishList = data;
                }
            )

            $scope.loadMore = function () {
                $customHttp.get(
                    'data/dish_getbypage.php?start=' + $scope.dishList.length,
                    function (data) {
                        if (data.length < 5) {
                            $scope.hasMore = false;
                        }
                        $scope.dishList = $scope.dishList.concat(data);
                        $scope.$broadcast('scroll.infiniteScrollComplete')
                    }
                )
            }

            $scope.$watch('inputTxt.kw', function () {

                $debounce(handleSearch, 300);

                //console.log($scope.inputTxt.kw);


            })
            handleSearch = function () {
                if ($scope.inputTxt.kw) {
                    $customHttp.get(
                        'data/dish_getbykw.php?kw=' + $scope.inputTxt.kw,
                        function (data) {
                            $scope.dishList = data;
                        }
                    )
                }
            }
        }

    ])

app.controller('detailCtrl',
    ['$scope', '$stateParams', '$customHttp', '$ionicPopup',
        function ($scope, $stateParams, $customHttp, $ionicPopup) {
            //console.log($stateParams);
            $customHttp.get(
                'data/dish_getbyid.php?id=' + $stateParams.id,
                function (data) {
                    //console.log(data)
                    $scope.dish = data[0];
                }
            )
            $scope.addToCart = function () {
                $customHttp.get('data/cart_update.php?uid=1&did=' + $scope.dish.did + '&count=-1', function (data) {
                    //console.log(data);
                    if (data.msg == 'succ') {
                        $scope.data.totalNumInCart++;
                        $ionicPopup.alert({
                            template: '添加到购物车成功'
                        })
                    }
                })
            }
        }
    ])


app.controller('orderCtrl',
    ['$scope',
        '$stateParams',
        '$httpParamSerializerJQLike',
        '$customHttp',
        function ($scope,
                  $stateParams,
                  $httpParamSerializerJQLike,
                  $customHttp) {
            var totalPrice = 0;
            angular.forEach(angular.fromJson($stateParams.cartDetail), function (value, key) {
                totalPrice += value.price * value.dishCount;
            });
            $scope.order = {
                userid: 1,
                cartDetail: $stateParams.cartDetail,
                totalprice: totalPrice
            };
            $scope.submitOrder = function () {

                var result = $httpParamSerializerJQLike($scope.order)
                $customHttp.get(
                    'data/order_add.php?' + result,
                    function (data) {
                        console.log(data);
                        if (data[0].msg = 'succ') {
                            $scope.result = "下单成功，订单编号为" + data[0].oid;
                            $scope.data.totalNumInCart = 0;
                        }
                        else {
                            $scope.result = "下单失败！";
                        }
                    }
                )
            }
        }
    ])

app.controller('myOrderCtrl',
    ['$scope', '$customHttp',
        function ($scope, $customHttp) {
            var phone = sessionStorage.getItem('phone')
            $customHttp.get(
                'data/order_getbyuserid.php?userid=1',
                function (data) {
                    //console.log(data);
                    $scope.orderList = data.data;
                }
            )
        }
    ]
)

app.controller('settingCtrl',
    ['$scope', '$ionicModal',
        function ($scope, $ionicModal) {

            $ionicModal
                .fromTemplateUrl(
                'tpl/about.html',
                {
                    scope: $scope
                }
            ).then(function (modal) {
                    $scope.modal = modal;
                })


            $scope.open = function () {
                $scope.modal.show();
            }

            $scope.close = function () {
                $scope.modal.hide();
            }
        }
    ]);
app.controller('cartCtrl', ['$scope', '$customHttp', function ($scope, $customHttp) {
    $customHttp.get('data/cart_select.php?uid=1', function (data) {
        //console.log(data);
        $scope.product = data.data;
        updateTotalNum();
    });
    updateTotalNum = function () {
        $scope.data.totalNumInCart = 0;
        angular.forEach($scope.product, function (value, key) {
            $scope.data.totalNumInCart += parseFloat(value.dishCount);
        });
    }

    $scope.sumAll = function () {
        var totalPrice = 0;
        angular.forEach($scope.product, function (value, key) {
            totalPrice += (value.price * value.dishCount);
        });
        return totalPrice;
    };
    $scope.editEnable = false;
    $scope.reserve = function () {
        $scope.editEnable = !$scope.editEnable;
    };
    $scope.deleteEnable = false;
    $scope.reserveD = function () {
        $scope.deleteEnable = !$scope.deleteEnable;
    };

    $scope.add = function (index) {
        $scope.product[index].dishCount++;
        $customHttp.get('data/cart_update.php?uid=1&did=' + $scope.product[index].did + '&count=' + $scope.product[index].dishCount, function (dataFromServer) {
            //console.log(dataFromServer);
            updateTotalNum();
        });
    };
    $scope.minus = function (index) {
        $scope.product[index].dishCount--;
        if ($scope.product[index].dishCount == 0) {
            $scope.product[index].dishCount = 1;
        } else {
            $customHttp.get('data/cart_update.php?uid=1&did=' + $scope.product[index].did + '&count=' + $scope.product[index].dishCount, function (dataFromServer) {
                //console.log(dataFromServer);
                updateTotalNum();
            });
        }
    };
    $scope.jumpToOrder = function () {
        var result = angular.toJson($scope.product);
        $scope.jump('order', {cartDetail: result});
    }
    $scope.delete = function (index) {
        $customHttp.get('data/cart_update.php?uid=1&did=' + $scope.product[index].did + '&count=-2', function (data) {
            $scope.product.splice(index, 1);
            //console.log($scope.product);

            updateTotalNum();
        });
    }
}]);







