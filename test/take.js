var pull = require('../')
var test = require('tape')

test('through - onEnd', function (t) {
  t.plan(2)
  var values = [1,2,3,4,5,6,7,8,9,10]

  //read values, and then just stop!
  //this is a subtle edge case for take!

//I did have a thing that used this edge case,
//but it broke take, actually. so removing it.
//TODO: fix that thing - was a test for some level-db stream thing....

//  pull.Source(function () {
//    return function (end, cb) {
//      if(end) cb(end)
//      else if(values.length)
//        cb(null, values.shift())
//      else console.log('drop')
//    }
//  })()

  pull(
    pull.values(values),
    pull.take(10),
    pull.through(null, function (err) {
      console.log('end')
      t.ok(true)
      process.nextTick(function () {
        t.end()
      })
    }),
    pull.collect(function (err, ary) {
      console.log(ary)
      t.ok(true)
    })
  )
})


test('take - exclude last (default)', function (t) {
  pull(
    pull.values([1,2,3,4,5,6,7,8,9,10]),
    pull.take(function(n) {return n<5}),
    pull.collect(function (err, four) {
      t.deepEqual(four, [1,2,3,4])
      t.end()
    })
  )
})
test('take - include last', function (t) {
  pull(
    pull.values([1,2,3,4,5,6,7,8,9,10]),
    pull.take(function(n) {return n<5}, {last: true}),
    pull.collect(function (err, five) {
      t.deepEqual(five, [1,2,3,4,5])
      t.end()
    })
  )
})

test('take 5 causes 5 reads upstream', function (t) {
  var reads = 0
  pull(
    pull.values([1,2,3,4,5,6,7,8,9,10]),
    function (read) {
      return function (end, cb) {
        if (end !== true) reads++
        console.log(reads, end)
        read(end, cb)
      }
    },
    pull.take(5),
    pull.collect(function (err, five) {
      t.deepEqual(five, [1,2,3,4,5])
      process.nextTick(function() {
          t.equal(reads, 5)
          t.end()
        })
    })
  )
})

test("take doesn't abort until the last read", function (t) {

  var aborted = false

  var ary = [1,2,3,4,5], i = 0

  var read = pull(
    function (abort, cb) {
      if(abort) cb(aborted = true)
      else if(i > ary.length) cb(true)
      else cb(null, ary[i++])
    },
    pull.take(function (d) {
      return d < 3
    }, {last: true})
  )

  read(null, function (_, d) {
    t.notOk(aborted, "hasn't aborted yet")
    read(null, function (_, d) {
      t.notOk(aborted, "hasn't aborted yet")
      read(null, function (_, d) {
        t.notOk(aborted, "hasn't aborted yet")
        read(null, function (end, d) {
          t.ok(end, 'stream ended')
          t.equal(d, undefined, 'data undefined')
          t.ok(aborted, "has aborted by now")
          t.end()
        })
      })
    })
  })

})

test('take when abort on the first message', function (t) {

  var read = pull(
    function (err, cb) {
      t.ok(err)
      cb(err)
    },
    pull.take(5)
  )

  read(true, function (err) {
    t.ok(err)
    t.end()
  })

})

test('take when abort on the first message', function (t) {

  var cbs = []

  var read = pull(
    function (err, cb) {
      cbs.push(cb)
    },
    pull.take(5)
  )

  read(null, function () {

  })

  read(true, function (err) {
    t.ok(err)
    t.end()
  })

  t.equal(cbs.length, 2)

  var abort_cb = cbs.pop()
  abort_cb(true)
})

test("take doesn't abort multiple times when aborted early", function (t) {
  var abortNb = 0
  var sourceAns = [] // Delays answers to control the ordering of events
  var sinkAns = [
    function (done, d) { 
      t.notOk(done)
      read(null, sinkAns[1]) // Ask another value...
      read(true, sinkAns[2]) // ...but abort before the answer comes back
      t.equal(abortNb, 1, "Aborting only once upstream")
      sourceAns.shift()(true)
      
      // Should not have pending answers but in case it does execute the others
      // to end the test
      while (sourceAns.length > 0) sourceAns.shift()(true)
    },
    function (done, d) { t.ok(done) },
    function (done, d) { t.ok(done); t.end() }
  ]

  var read = pull(
    function (abort, cb) {
      if(abort) {
        abortNb++
      }
      sourceAns.push(cb)
    },
    pull.take(1)
  )

  read(null, sinkAns[0]) // Sink asks a value
  sourceAns.shift()(false, 1) // Source answers with a value

})
