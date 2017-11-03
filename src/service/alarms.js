import { Op } from 'sequelize'

export default class AlarmService {
  constructor(dispatchService, alarmModel, syncStateModel, receiptModel, configurationService) {
    this.dispatchService = dispatchService
    this.alarmModel = alarmModel
    this.syncStateModel = syncStateModel
    this.receiptModel = receiptModel
    this.configuration = configurationService
  }

  /**
   * Retrieve a list of all alarms
   * @param [where] add restrictions on what alarms to fetch
   */
  getAlarms(where = { id: undefined, addresses: [] }) {
    const internalWhere = {}
    if (where.addresses && where.addresses.length) {
      internalWhere.address = {
        [Op.in]: where.addresses
      }
    }

    if (where.id) {
      internalWhere.id = where.id
    }

    return this.alarmModel
      .findAll({
        where: internalWhere
      })
      .map(function(alarm) {
        alarm.dataValues.abi = JSON.parse(alarm.dataValues.abi)
        alarm.dataValues.eventNames = alarm.dataValues.eventNames.split(',')
        return alarm.dataValues
      })
  }

  storeLastSyncBlock(contractAddress, height) {
    return this.alarms
      .getAlarms({ addresses: [contractAddress] })
      .then(async results => {
        const syncStates = []

        for (let x = 0; x < results.length; ++x) {
          const alarm = results[x]

          await this.syncStateModel
            .findOrCreate({
              where: {
                alarmId: alarm.id
              },
              defaults: {
                alarmId: alarm.id,
                lastSyncBlock: height
              }
            })
            .spread(async (record, created) => {
              // console.log(record, created)
              // Update the last block sync if it already exists and is lower
              if (!created && height > record.dataValues.lastSyncBlock) {
                await record.update({
                  lastSyncBlock: height
                })
              }

              syncStates.push({
                alarmId: alarm.id,
                AlarmSyncState: record,
                createdAt: created
              })
            })
        }

        return syncStates
      })
  }


  /**
   * Store an alarm in the databas
   */
  storeNewAlarm(alarmDescription) {
    // store into the database
    return this.alarmModel.create({
      address: alarmDescription.address,
      abi: alarmDescription.abi,
      eventNames: alarmDescription.eventNames,
      email: alarmDescription.email,
      webhook: alarmDescription.webhook,
      blockConfirmations: alarmDescription.blockConfirmations
    })
  }

  /**
   * Retrieve a map of addresses to all alarms stored in the database
   */
  mapAddressesToAlarm(addresses = []) {
    return this.getAlarms({ addresses: addresses }).reduce(
      function(map, obj) {
        if (!map[obj.address]) map[obj.address] = []
        map[obj.address].push(obj)
        return map
      },
      {}
    )
  }

  /**
   * Configure the maximum amount of reorgs we might expect to happen
   */
  getReorgSafety() {
    return this.configuration.getReorgSafety()
  }

  mapByTransactionId(events) {
    const result = {}
    for (let event of events) {
      result[event.txHash] = result[event.txHash] || []
      result[event.txHash].push(event)
    }
    return Object.values(result)
  }

  getContractData(addressToAlarms) {
    return Object.keys(addressToAlarms).map(address => {
      return {
        address,
        abi: addressToAlarms[address][0].abi
      }
    })
  }

  /**
   * Retrieve a mapping of each address, linking to the latest sync
   * stored in the database for that address
   */
  mapAddressesToLastSync(addresses, defaultLastSync) {
    return this.alarmModel
      .findAll({
        include: [
          {
            model: this.syncStateModel
            // Automagically handles the deleted at flag :)
          }
        ],
        where: {
          address: {
            [Op.in]: addresses
          }
        }
      })
      .reduce(function(addrtolastsync, alarm) {
        let lastSyncBlock = defaultLastSync
        if (alarm.AlarmSyncState !== null)
          lastSyncBlock = alarm.AlarmSyncState.dataValues.lastSyncBlock

        // Only return the greatest lastBlockSync for specified address
        if (
          addrtolastsync[alarm.dataValues.address] === undefined ||
          lastSyncBlock > addrtolastsync[alarm.dataValues.address]
        )
          addrtolastsync[alarm.dataValues.address] = lastSyncBlock

        return addrtolastsync
      }, {})
  }

  /**
   * Retrieve a receipt from the database
   */
  getReceipt(alarmId, txHash) {
    return this.receiptModel.findAll({
      where: {
        alarmId: alarmId,
        txHash: txHash
      }
    })
  }

  dispatchNotification(alarm, event) {
    return this.dispatchService.dispath(alarm, event)
  }
}
