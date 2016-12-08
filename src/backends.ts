// def _gen_erfcinv(erfc, math=math):
//     """Generates the inverse function of erfc by the given erfc function and
//     math module.
//     """
//     def erfcinv(y):
//         """The inverse function of erfc."""
//         if y >= 2:
//             return -100.
//         elif y <= 0:
//             return 100.
//         zero_point = y < 1
//         if not zero_point:
//             y = 2 - y
//         t = math.sqrt(-2 * math.log(y / 2.))
//         x = -0.70711 * \
//             ((2.30753 + t * 0.27061) / (1. + t * (0.99229 + t * 0.04481)) - t)
//         for i in range(2):
//             err = erfc(x) - y
//             x += err / (1.12837916709551257 * math.exp(-(x ** 2)) - x * err)
//         return x if zero_point else -x
//     return erfcinv
