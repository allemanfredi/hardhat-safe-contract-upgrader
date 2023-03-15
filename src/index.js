const { task, types } = require('hardhat/config')
const { calculateSafeTransactionHash, safeSignMessage, buildSafeTransaction } = require('@gnosis.pm/safe-contracts')
const TransparentUpgradeableProxy = require('@openzeppelin/upgrades-core/artifacts/@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol/TransparentUpgradeableProxy.json')
const ProxyAdmin = require('@openzeppelin/upgrades-core/artifacts/@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol/ProxyAdmin.json')
const SafeServiceClient = require('@safe-global/safe-service-client').default
const EthersAdapter = require('@safe-global/safe-ethers-lib').default
const { Manifest, getAdminAddress, getCode, isEmptySlot } = require('@openzeppelin/upgrades-core')
const { getSafeSingletonDeployment } = require('@gnosis.pm/safe-deployments')

const ChainIdToTxServiceUrl = {
  1: 'https://safe-transaction-mainnet.safe.global',
  56: 'https://safe-transaction-bsc.safe.global',
  137: 'https://safe-transaction-polygon.safe.global'
}

const contractInstance = async (_hre, deployment, _address) => {
  if (!deployment) throw Error('No deployment provided')
  const contractAddress = _address || deployment.defaultAddress
  return await _hre.ethers.getContractAt(deployment.abi, contractAddress)
}

const safeSingleton = async (_hre, _address) =>
  contractInstance(_hre, getSafeSingletonDeployment({ released: undefined }), _address)

task('propose-upgrade', 'Propose a Safe transaction to upgrade a contract')
  .addParam(
    'factory',
    'The name of the factory contract that will be used as new implementation',
    undefined,
    types.string,
    false
  )
  .addParam('safe', 'The Gnosis Safe address', undefined, types.string, false)
  .addParam('proxy', 'The proxy contract address to upgrade', undefined, types.string, false)
  .addParam('safeTxGas', 'The safe safeTransaction gas', 1000000, types.int, true)
  .addParam('baseGas', 'The base gas', 1000000, types.int, true)
  .addParam('gasPrice', 'The gas price', 0, types.int, true)
  .addParam('origin', 'The origin', 'hardhat-safe-contract-upgrader', types.string, true)
  .addParam('txServiceUrl', 'The Safe Transaction Service API endpoint', ChainIdToTxServiceUrl[1], types.string, true)
  .setAction(async (_taskArgs, _hre) => {
    const { ethers, upgrades } = _hre
    const signer = await ethers.getSigner()
    const {
      baseGas,
      factory,
      gasPrice,
      proxy: proxyAddress,
      safe: safeAddress,
      safeTxGas,
      origin,
      txServiceUrl
    } = _taskArgs

    const chainId = (await ethers.provider.getNetwork()).chainId
    const safeService = new SafeServiceClient({
      txServiceUrl: ChainIdToTxServiceUrl[chainId] || txServiceUrl,
      ethAdapter: new EthersAdapter({
        ethers,
        signerOrProvider: ethers.provider
      })
    })

    const Factory = await ethers.getContractFactory(factory)
    const newImplementationAddress = await upgrades.deployImplementation(Factory)

    const adminAddress = await getAdminAddress(ethers.provider, proxyAddress)
    const adminBytecode = await getCode(ethers.provider, adminAddress)

    const txObj = {
      value: 0,
      operation: 0,
      gasPrice,
      safeTxGas,
      baseGas
    }

    if (isEmptySlot(adminAddress) || adminBytecode === '0x') {
      // No admin contract: use TransparentUpgradeableProxyFactory to get proxiable interface
      const TransparentUpgradeableProxyFactory = await ethers.getContractFactory(
        TransparentUpgradeableProxy.abi,
        TransparentUpgradeableProxy.bytecode,
        signer
      )
      const proxy = TransparentUpgradeableProxyFactory.attach(proxyAddress)
      txObj.to = proxy.address
      txObj.data = proxy.interface.encodeFunctionData('upgradeTo', [newImplementationAddress])
    } else {
      const manifest = await Manifest.forNetwork(ethers.provider)
      const AdminFactory = await ethers.getContractFactory(ProxyAdmin.abi, ProxyAdmin.bytecode, signer)
      const admin = AdminFactory.attach(adminAddress)
      const manifestAdmin = await manifest.getAdmin()

      if (admin.address !== manifestAdmin?.address) {
        throw new Error('Proxy admin is not the one registered in the network manifest')
      }

      txObj.to = admin.address
      txObj.data = admin.interface.encodeFunctionData('upgrade', [newImplementationAddress])
    }

    const safe = await safeSingleton(_hre, safeAddress)
    txObj.nonce = (await safe.nonce()).toString()
    const safeTransaction = buildSafeTransaction(txObj)
    const signature = await safeSignMessage(signer, safe, safeTransaction, chainId)

    await safeService.proposeTransaction({
      safeAddress,
      safeTxHash: calculateSafeTransactionHash(safe, safeTransaction, chainId),
      safeTransactionData: safeTransaction,
      senderAddress: signer.address,
      senderSignature: signature.data,
      origin
    })
  })
