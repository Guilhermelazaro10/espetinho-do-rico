const { Router } = require('express');

const produtosRoutes = require('./produtos.routes');
const mesasRoutes = require('./mesas.routes');
const pedidosRoutes = require('./pedidos.routes');
const relatoriosRoutes = require('./relatorios.routes');
const usuariosRoutes = require('./usuarios.routes');
const caixaRoutes = require('./caixa.routes');
const perfilRoutes = require('./perfil.routes');

const router = Router();

router.use('/produtos', produtosRoutes);
router.use('/mesas', mesasRoutes);
router.use('/pedidos', pedidosRoutes);
router.use('/relatorios', relatoriosRoutes);
router.use('/usuarios', usuariosRoutes);
router.use('/caixa', caixaRoutes);
router.use('/perfil', perfilRoutes);

module.exports = router;
