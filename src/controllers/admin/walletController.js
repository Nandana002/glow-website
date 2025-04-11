import mongoose from 'mongoose';
import User from "../../models/userSchema.js"
import { Wallet } from "../../models/walletSchema.js";
import { HttpStatus } from "../../statusCode.js";
//using get all wallet details
const getAllWallets = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, minBalance, maxBalance, userId, transactionType, transactionPage = 1, transactionLimit = 10 } = req.query;
    let query = {};
    
    if (search) {
      const users = await User.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ]
      }).select('_id');
      
      const userIds = users.map(user => user._id);
      query.userId = { $in: userIds };
    }
    
    if (userId) {
      query.userId = userId;
    }
    
    if (minBalance) query.balance = { $gte: parseFloat(minBalance) };
    if (maxBalance) query.balance = { ...query.balance, $lte: parseFloat(maxBalance) };
    
    const wallets = await Wallet.find(query)
      .populate('userId', 'name email')
      .limit(limit * 1)
      .skip((page - 1) * limit);
      
    const total = await Wallet.countDocuments(query);
    
    const allTransactions = [];
    
    for (const wallet of wallets) {
      if (wallet.transactionHistory && wallet.transactionHistory.length > 0) {
        const walletTransactions = wallet.transactionHistory.map(transaction => ({
          walletId: wallet._id,
          transactionType: transaction.transactionType || 'unknown',
          transactionAmount: transaction.transactionAmount || 0,
          transactionDate: transaction.transactionDate || new Date(),
          description: transaction.description || 'No description'
        }));
          
        allTransactions.push(...walletTransactions);
      }
    }
    
    allTransactions.sort((a, b) => 
      new Date(b.transactionDate) - new Date(a.transactionDate)
    );
    
   
    const totalTransactions = allTransactions.length;
    const startIndex = (transactionPage - 1) * transactionLimit;
    const endIndex = startIndex + parseInt(transactionLimit);
    const paginatedTransactions = allTransactions.slice(startIndex, endIndex);
    const totalTransactionPages = Math.ceil(totalTransactions / transactionLimit);
    
    res.render('admin-wallet', {
      wallets,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      search,
      minBalance,
      maxBalance,
      userId,
      transactionType,
      recentTransactions: paginatedTransactions,
      transactionPage: parseInt(transactionPage),
      transactionLimit: parseInt(transactionLimit),
      totalTransactions,
      totalTransactionPages
    });
  } catch (err) {
    console.error('Error in getAllWallets:', err);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).send('Server Error');
  }
};

//user to get user wallet details
  const getUserWallet = async (req, res) => {
    try {
      const { page = 1, limit = 10 } = req.query;
      
   
      const wallet = await Wallet.findOne({ userId: req.params.userId })
        .populate('userId', 'name email');
      
      if (!wallet) {
        return res.status(HttpStatus.NOT_FOUND).send('Wallet not found');
      }
      
      const user = wallet.userId;
      
      if (!user) {
        return res.status(HttpStatus.NOT_FOUND).send('User not found for this wallet');
      }
      
      const totalHistory = wallet.transactionHistory.length;
      const paginatedHistory = wallet.transactionHistory
        .sort((a, b) => new Date(b.transactionDate) - new Date(a.transactionDate))
        .slice((page - 1) * limit, page * limit);
      
      res.render('wallet-details', {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          wallet: wallet.balance 
        },
        walletHistory: paginatedHistory.map(transaction => ({
          date: transaction.transactionDate,
          type: transaction.transactionAmount > 0 ? 'credit' : 'debit',
          amount: Math.abs(transaction.transactionAmount),
          description: transaction.description
        })),
        totalHistory,
        page: parseInt(page),
        limit: parseInt(limit)
      });
    } catch (err) {
      console.error('Error in getWalletDetails:', err);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).send('Server Error');
    }
  };

//using to credit wallet
const creditWallet = async (req, res) => {
  try {
    const { amount, description } = req.body;
    
    const wallet = await Wallet.findOne({ userId: req.params.userId });
    
    if (!wallet) {
      return res.status(HttpStatus.NOT_FOUND).send('Wallet not found');
    }
    
    wallet.balance += parseFloat(amount);
    
    wallet.transactionHistory.push({
      transactionType: 'manual',
      transactionAmount: parseFloat(amount),
      transactionDate: new Date(),
      description: description || 'Admin credit'
    });
    
    await wallet.save();
    res.redirect(`/admin/wallets/${req.params.userId}`);
  } catch (err) {
    console.error('Error in creditWallet:', err);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).send('Server Error');
  }
};
//using to debit wallet
const debitWallet = async (req, res) => {
  try {
    const { amount, description } = req.body;
    
    const wallet = await Wallet.findOne({ userId: req.params.userId });
    
    if (!wallet) {
      return res.status(HttpStatus.NOT_FOUND).send('Wallet not found');
    }
    
    if (wallet.balance < parseFloat(amount)) {
      return res.status(HttpStatus.BAD_REQUEST).send('Insufficient balance');
    }
    
    wallet.balance -= parseFloat(amount);
    
    wallet.transactionHistory.push({
      transactionType: 'manual',
      transactionAmount: -parseFloat(amount),
      transactionDate: new Date(),
      description: description || 'Admin debit'
    });
    
    await wallet.save();
    res.redirect(`/admin/wallets/${req.params.userId}`);
  } catch (err) {
    console.error('Error in debitWallet:', err);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).send('Server Error');
  }
};
//using to create wallet
const createWallet = async (req, res) => {
  try {
    const { userId } = req.body;
    
    const existingWallet = await Wallet.findOne({ userId });
    if (existingWallet) {
      return res.status(HttpStatus.BAD_REQUEST).send('Wallet already exists for this user');
    }
    
    const wallet = new Wallet({
      userId,
      balance: 0,
      transactionHistory: []
    });
    
    await wallet.save();
    res.status(HttpStatus.CREATED).json({ message: 'Wallet created successfully', wallet });
  } catch (err) {
    console.error('Error in createWallet:', err);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).send('Server Error');
  }
};

export {
  debitWallet,
  getAllWallets,
  creditWallet,
  getUserWallet,
  createWallet
}