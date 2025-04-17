import { Order } from "../../models/orderSchema.js"
import { HttpStatus } from "../../statusCode.js";
//using to get the salers report
const getSalesReport = async (req, res) => {
    try {
        const { startDate, endDate, reportType } = req.query;
        let query = {};
        let dateRange = {};
        switch (reportType) {
            case 'daily':
                dateRange = {
                    startDate: new Date(new Date().setHours(0, 0, 0, 0)),
                    endDate: new Date(new Date().setHours(23, 59, 59, 999))
                };
                break;
            case 'weekly':
                const weekStart = new Date();
                weekStart.setDate(weekStart.getDate() - weekStart.getDay());
                weekStart.setHours(0, 0, 0, 0);
                dateRange = { startDate: weekStart, endDate: new Date() };
                break;
            case 'monthly':
                const monthStart = new Date();
                monthStart.setDate(1);
                monthStart.setHours(0, 0, 0, 0);
                dateRange = { startDate: monthStart, endDate: new Date() };
                break;
            case 'custom':
                dateRange = { startDate: new Date(startDate), endDate: new Date(endDate) };
                break;
            default:
                dateRange = {
                    startDate: new Date(new Date().setHours(0, 0, 0, 0)),
                    endDate: new Date(new Date().setHours(23, 59, 59, 999))
                };
        }

        query = {
            createdOn: { $gte: dateRange.startDate, $lte: dateRange.endDate },
            status: { $nin: ['Cancelled', 'Pending', 'Processing', 'Return Requested', 'Returned'] }
        };

        const orders = await Order.find(query).sort({ createdOn: -1 });

        console.log('Raw Orders from DB:', JSON.stringify(orders.map(o => ({
            orderId: o.orderId,
            totalPrice: o.totalPrice,
            discount: o.discount,
            finalAmount: o.finalAmount,
            couponApplied: o.couponApplied,
            status: o.status
        })), null, 2));

        const reportData = {
            totalOrders: orders.length,
            totalSales: orders.reduce((sum, order) => sum + (order.totalPrice || 0), 0),
            totalDiscount: orders.reduce((sum, order) => {
                return sum + (order.totalPrice && order.finalAmount
                    ? order.totalPrice - order.finalAmount
                    : order.discount || 0);
            }, 0),
            couponDiscount: orders.reduce((sum, order) => {
                if (order.couponApplied) {
                    return sum + (order.totalPrice && order.finalAmount
                        ? order.totalPrice - order.finalAmount
                        : order.discount || 0);
                }
                return sum;
            }, 0),
            orders: orders.map(order => ({
                orderId: order.orderId || 'N/A',
                date: order.createdOn,
                amount: order.totalPrice || 0,
                discount: order.totalPrice && order.finalAmount
                    ? order.totalPrice - order.finalAmount
                    : order.discount || 0,
                finalAmount: order.finalAmount || order.totalPrice || 0,
                status: order.status || 'Unknown',
                paymentMethod: order.paymentMethod || 'N/A'
            }))
        };

        console.log('Processed Report Data:', JSON.stringify(reportData, null, 2));

        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.json(reportData);
        } else {
            return res.render('salesReport', {
                reportData,
                startDate: dateRange.startDate,
                endDate: dateRange.endDate,
                reportType,
                title: 'Sales Report'
            });
        }
    } catch (error) {
        console.error('Error generating sales report:', error);
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: 'Error generating sales report'
        });
    }
};


import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit-table';
import fs from 'fs';
import path from 'path';


//format currenct=y
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR'
    }).format(amount);
};

//using to get date range
const getDateRange = (reportType, startDate, endDate) => {
    const now = new Date();
    let start = new Date(now);
    let end = new Date(now);

    switch (reportType) {
        case 'daily':
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
            break;
        case 'weekly':
            start.setDate(now.getDate() - now.getDay());
            start.setHours(0, 0, 0, 0);
            break;
        case 'monthly':
            start.setDate(1);
            start.setHours(0, 0, 0, 0);
            break;
        case 'custom':
            start = new Date(startDate);
            end = new Date(endDate);
            break;
    }
    return { start, end };
};
//using to export sales report
const exportSalesReport = async (req, res) => {
    try {
        const { type, reportType, startDate, endDate } = req.query;
        const dateRange = getDateRange(reportType, startDate, endDate);

        const orders = await Order.find({
            createdOn: {
                $gte: dateRange.start,
                $lte: dateRange.end
            },
            status: { $nin: ['Cancelled', 'Pending', 'Processing', 'Return Requested', 'Returned'] }
        }).populate('userId', 'name email');

        const totals = {
            totalSales: orders.reduce((sum, order) => sum + (order.finalAmount || 0), 0),
            totalDiscount: orders.reduce((sum, order) => sum + (order.discount || 0), 0),
            totalOrders: orders.length,
            paymentMethods: orders.reduce((acc, order) => {
                acc[order.paymentMethod] = (acc[order.paymentMethod] || 0) + 1;
                return acc;
            }, {})
        };

        if (type === 'excel') {
            await generateExcelReport(orders, totals, dateRange, res);
        } else if (type === 'pdf') {
            await generatePDFReport(orders, totals, dateRange, res);
        } else {
            res.status(HttpStatus.BAD_REQUEST).json({ status: false, message: 'Invalid export type' });
        }
    } catch (error) {
        console.error('Export error:', error);
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ status: false, message: 'Error generating report' });
    }
};
//using to generate excel report
const generateExcelReport = async (orders, totals, dateRange, res) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sales Report');

    // Title
    worksheet.mergeCells('A1:H1');
    worksheet.getCell('A1').value = 'Sales Report';
    worksheet.getCell('A1').font = { size: 16, bold: true };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };

    // Date Range
    worksheet.mergeCells('A2:H2');
    worksheet.getCell('A2').value = `Period: ${dateRange.start.toLocaleDateString()} to ${dateRange.end.toLocaleDateString()}`;
    worksheet.getCell('A2').alignment = { horizontal: 'center' };

    // Summary
    worksheet.addRow(['']);
    worksheet.addRow(['Summary']);
    worksheet.addRow(['Total Orders', totals.totalOrders]);
    worksheet.addRow(['Total Sales', formatCurrency(totals.totalSales)]);
    worksheet.addRow(['Total Discount', formatCurrency(totals.totalDiscount)]);
    worksheet.addRow(['Net Amount', formatCurrency(totals.totalSales - totals.totalDiscount)]);

    // Payment Methods Summary
    worksheet.addRow(['']);
    worksheet.addRow(['Payment Methods']);
    Object.entries(totals.paymentMethods).forEach(([method, count]) => {
        worksheet.addRow([method, count]);
    });
    worksheet.addRow(['']);

    // Headers
    worksheet.addRow([
        'Order ID',
        'Date',
        'Customer',
        'Amount',
        'Discount',
        'Final Amount',
        'Payment Method',
        'Status'
    ]);

    const headerRow = worksheet.lastRow;
    headerRow.font = { bold: true };
    headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
    };

    // Data rows
    orders.forEach(order => {
        worksheet.addRow([
            order.orderId,
            new Date(order.createdOn).toLocaleDateString(),
            order.userId?.name || 'N/A',
            order.totalPrice,
            order.discount,
            order.finalAmount,
            order.paymentMethod,
            order.status
        ]);
    });

    // Column formatting
    worksheet.columns.forEach(column => {
        column.width = 15;
        column.alignment = { horizontal: 'left' };
    });

    // Headers
    res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
        'Content-Disposition',
        'attachment; filename=sales-report.xlsx'
    );

    await workbook.xlsx.write(res);
};
//using to generate pdf report
const generatePDFReport = async (orders, totals, dateRange, res) => {
    const doc = new PDFDocument({ margin: 30, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=sales-report.pdf');

    doc.pipe(res);

    // Title
    doc.fontSize(20).text('Sales Report', { align: 'center' });
    doc.moveDown();

    // Date Range
    doc.fontSize(12).text(
        `Period: ${dateRange.start.toLocaleDateString()} to ${dateRange.end.toLocaleDateString()}`,
        { align: 'center' }
    );
    doc.moveDown();

    // Summary Table
    const summaryTable = {
        headers: ['Metric', 'Value'],
        rows: [
            ['Total Orders', totals.totalOrders.toString()],
            ['Total Sales', formatCurrency(totals.totalSales)],
            ['Total Discount', formatCurrency(totals.totalDiscount)],
            ['Net Amount', formatCurrency(totals.totalSales - totals.totalDiscount)]
        ]
    };

    await doc.table(summaryTable, {
        prepareHeader: () => doc.font('Helvetica-Bold'),
        prepareRow: () => doc.font('Helvetica')
    });

    doc.moveDown();

    // Payment Methods Summary
    doc.fontSize(12).text('Payment Methods Summary', { underline: true });
    doc.moveDown(0.5);

    const paymentMethodsTable = {
        headers: ['Payment Method', 'Count'],
        rows: Object.entries(totals.paymentMethods).map(([method, count]) => [
            method,
            count.toString()
        ])
    };

    await doc.table(paymentMethodsTable, {
        prepareHeader: () => doc.font('Helvetica-Bold'),
        prepareRow: () => doc.font('Helvetica')
    });

    doc.moveDown();

    // Orders Table
    const ordersTable = {
        headers: ['Order ID', 'Date', 'Amount', 'Discount', 'Final', 'Payment', 'Status'],
        rows: orders.map(order => [
            order.orderId,
            new Date(order.createdOn).toLocaleDateString(),
            formatCurrency(order.totalPrice),
            formatCurrency(order.discount),
            formatCurrency(order.finalAmount),
            order.paymentMethod,
            order.status
        ])
    };

    await doc.table(ordersTable, {
        prepareHeader: () => doc.font('Helvetica-Bold').fontSize(10),
        prepareRow: () => doc.font('Helvetica').fontSize(10)
    });

    doc.end();
};
//using to get sales data
const getSalesData = async (req, res) => {
    try {
        const { filterType } = req.query;
        const currentDate = new Date();
        let startDate;


        switch (filterType) {
            case 'yearly':
                startDate = new Date(currentDate);
                startDate.setFullYear(currentDate.getFullYear() - 2);
                startDate.setMonth(0, 1); // Start of the year
                break;
            case 'monthly':
                startDate = new Date(currentDate);
                startDate.setMonth(currentDate.getMonth() - 5, 1); // Last 6 months
                break;
            case 'weekly':
                startDate = new Date(currentDate);
                startDate.setDate(currentDate.getDate() - 6); // Last 7 days
                startDate.setHours(0, 0, 0, 0);
                break;
            default:
                return res.status(HttpStatus.BAD_REQUEST).json({
                    success: false,
                    message: "Invalid filter type"
                });
        }


        console.log('Date Range:', {
            startDate,
            currentDate
        });

        const totalOrders = await Order.countDocuments({ status: 'Delivered' });
        console.log('Total Delivered Orders:', totalOrders);

        const sampleOrder = await Order.findOne({ status: 'Delivered' });
        console.log('Sample Order Structure:', JSON.stringify(sampleOrder, null, 2));

        const matchQuery = {
            status: 'Delivered',
            createdOn: {
                $gte: startDate,
                $lte: currentDate
            }
        };

        console.log('Match Query:', JSON.stringify(matchQuery, null, 2));

        const pipeline = [
            {
                $match: matchQuery
            },
            {
                $unwind: '$orderedItems'
            },
            {
                $match: {
                    'orderedItems': { $exists: true, $not: { $size: 0 } }
                }
            },
            {
                $group: {
                    _id: filterType === 'yearly'
                        ? { $year: '$createdOn' }
                        : filterType === 'monthly'
                            ? {
                                year: { $year: '$createdOn' },
                                month: { $month: '$createdOn' }
                            }
                            : {
                                year: { $year: '$createdOn' },
                                month: { $month: '$createdOn' },
                                day: { $dayOfMonth: '$createdOn' }
                            },
                    totalAmount: {
                        $sum: {
                            $multiply: ['$orderedItems.price', '$orderedItems.quantity']
                        }
                    },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { '_id': 1 }
            }
        ];

        console.log('Aggregation Pipeline:', JSON.stringify(pipeline, null, 2));

        const salesData = await Order.aggregate(pipeline);


        console.log('Raw Aggregation Results:', JSON.stringify(salesData, null, 2));


        let labels = [];
        let data = [];

        if (filterType === 'yearly') {
            const years = Array.from({ length: 3 }, (_, i) => currentDate.getFullYear() - 2 + i);
            years.forEach(year => {
                const yearData = salesData.find(item =>
                    typeof item._id === 'number' ? item._id === year : item._id.year === year
                );
                labels.push(year.toString());
                data.push(yearData ? Math.round(yearData.totalAmount) : 0);
            });
        } else if (filterType === 'monthly') {
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const months = Array.from({ length: 6 }, (_, i) => {
                const date = new Date(currentDate);
                date.setMonth(currentDate.getMonth() - 5 + i);
                return {
                    year: date.getFullYear(),
                    month: date.getMonth() + 1,
                    label: monthNames[date.getMonth()]
                };
            });

            months.forEach(({ year, month, label }) => {
                const monthData = salesData.find(item =>
                    item._id.year === year && item._id.month === month
                );
                labels.push(label);
                data.push(monthData ? Math.round(monthData.totalAmount) : 0);
            });
        } else {
            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            for (let i = 6; i >= 0; i--) {
                const date = new Date(currentDate);
                date.setDate(date.getDate() - i);

                const dayData = salesData.find(item =>
                    item._id.year === date.getFullYear() &&
                    item._id.month === (date.getMonth() + 1) &&
                    item._id.day === date.getDate()
                );

                labels.push(dayNames[date.getDay()]);
                data.push(dayData ? Math.round(dayData.totalAmount) : 0);
            }
        }

        console.log('Formatted Data:', {
            labels,
            data
        });

        return res.status(HttpStatus.OK).json({
            success: true,
            labels,
            data
        });

    } catch (error) {
        console.error('Error in getSalesData:', error);
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: "Internal Server Error",
            error: error.message
        });
    }
};

//
const generateLedger = async (req, res) => {
    try {
        const orders = await Order.aggregate([
            {
                $lookup: {
                    from: 'users',
                    localField: 'userId',
                    foreignField: '_id',
                    as: 'userInfo'
                }
            },
            {
                $unwind: '$userInfo'
            },
            {
                $project: {
                    orderId: 1,
                    userId: 1,
                    finalAmount: 1,
                    paymentMethod: 1,
                    status: 1,
                    createdOn: 1,
                    userName: '$userInfo.name'
                }
            },
            {
                $sort: { createdOn: -1 }
            }
        ]);
        console.log('orders', orders)

        if (!orders.length) {
            return res.status(HttpStatus.NOT_FOUND).json({ message: "No orders found" });
        }

        const doc = new PDFDocument({ margin: 40, size: 'A3', layout: 'landscape' });

        const reportsDir = path.join(__dirname, '../public/reports');
        if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
        }

        const filePath = path.join(reportsDir, 'ledger.pdf');
        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);

        // Title
        doc.fontSize(26).fillColor('#000').text('Ledger Book', { align: 'center', underline: true }).moveDown(1);

        // Column Settings
        const columnWidths = {
            orderId: 120,
            user: 150,
            amount: 100,
            paymentMethod: 120,
            status: 120,
            createdOn: 200
        };

        const totalTableWidth = Object.values(columnWidths).reduce((a, b) => a + b);
        const startX = (doc.page.width - totalTableWidth) / 2;
        const startY = doc.y;

        // Table Headers
        doc
            .font('Helvetica-Bold')
            .fontSize(14)
            .fillColor('#fff')
            .rect(startX, startY, totalTableWidth, 30)
            .fill('#333')
            .fillColor('#fff');

        doc.text('Order ID', startX + 10, startY + 8, { width: columnWidths.orderId, align: 'left' });
        doc.text('User', startX + 10 + columnWidths.orderId, startY + 8, { width: columnWidths.user, align: 'left' });
        doc.text('Amount', startX + 10 + columnWidths.orderId + columnWidths.user, startY + 8, { width: columnWidths.amount, align: 'center' });
        doc.text('Payment', startX + 10 + columnWidths.orderId + columnWidths.user + columnWidths.amount, startY + 8, { width: columnWidths.paymentMethod, align: 'center' });
        doc.text('Status', startX + 10 + columnWidths.orderId + columnWidths.user + columnWidths.amount + columnWidths.paymentMethod, startY + 8, { width: columnWidths.status, align: 'center' });
        doc.text('Order Created', startX + 10 + columnWidths.orderId + columnWidths.user + columnWidths.amount + columnWidths.paymentMethod + columnWidths.status, startY + 8, { width: columnWidths.createdOn, align: 'center' });

        doc.moveDown(1);


        let yPosition = startY + 40;
        const rowHeight = 40;
        const pageBottomMargin = doc.page.height - 60;

        orders.forEach((order, index) => {

            if (yPosition + rowHeight > pageBottomMargin) {
                doc.addPage();
                yPosition = 50;


                doc
                    .font('Helvetica-Bold')
                    .fontSize(14)
                    .fillColor('#fff')
                    .rect(startX, yPosition, totalTableWidth, 30)
                    .fill('#333')
                    .fillColor('#fff');

                doc.text('Order ID', startX + 10, yPosition + 8, { width: columnWidths.orderId, align: 'left' });
                doc.text('User', startX + 10 + columnWidths.orderId, yPosition + 8, { width: columnWidths.user, align: 'left' });
                doc.text('Amount', startX + 10 + columnWidths.orderId + columnWidths.user, yPosition + 8, { width: columnWidths.amount, align: 'center' });
                doc.text('Payment', startX + 10 + columnWidths.orderId + columnWidths.user + columnWidths.amount, yPosition + 8, { width: columnWidths.paymentMethod, align: 'center' });
                doc.text('Status', startX + 10 + columnWidths.orderId + columnWidths.user + columnWidths.amount + columnWidths.paymentMethod, yPosition + 8, { width: columnWidths.status, align: 'center' });
                doc.text('Order Created', startX + 10 + columnWidths.orderId + columnWidths.user + columnWidths.amount + columnWidths.paymentMethod + columnWidths.status, yPosition + 8, { width: columnWidths.createdOn, align: 'center' });

                yPosition += 40;
            }


            const bgColor = index % 2 === 0 ? '#f3f3f3' : '#fff';
            doc.rect(startX, yPosition, totalTableWidth, rowHeight).fill(bgColor).fillColor('#000');

            doc
                .font('Helvetica')
                .fontSize(12)
                .text(order.orderId.slice(-9), startX + 10, yPosition + 8, { width: columnWidths.orderId, align: 'left' })
                .text(order.userName || 'Guest', startX + 10 + columnWidths.orderId, yPosition + 8, { width: columnWidths.user, align: 'left' })
                .text(`₹${order.finalAmount.toFixed(2)}`, startX + 10 + columnWidths.orderId + columnWidths.user, yPosition + 8, { width: columnWidths.amount, align: 'center' })
                .text(order.paymentMethod, startX + 10 + columnWidths.orderId + columnWidths.user + columnWidths.amount, yPosition + 8, { width: columnWidths.paymentMethod, align: 'center' })
                .text(order.status, startX + 10 + columnWidths.orderId + columnWidths.user + columnWidths.amount + columnWidths.paymentMethod, yPosition + 8, { width: columnWidths.status, align: 'center' })
                .text(order.createdOn.toLocaleDateString('en-GB') + ' ' + order.createdOn.toLocaleTimeString('en-GB'), startX + 10 + columnWidths.orderId + columnWidths.user + columnWidths.amount + columnWidths.paymentMethod + columnWidths.status, yPosition + 8, { width: columnWidths.createdOn, align: 'center' });

            yPosition += rowHeight;
        });


        doc.moveDown(2);
        doc
            .font('Helvetica-Bold')
            .fontSize(12)
            .text(`Ledger Book Downloaded on: ${new Date().toLocaleDateString('en-GB')} at ${new Date().toLocaleTimeString('en-GB')}`, {
                align: 'right'
            });

        doc.end();

        stream.on('finish', () => {
            res.download(filePath, 'ledger.pdf', (err) => {
                if (err) console.error(err);
                fs.unlinkSync(filePath);
            });
        });


    } catch (error) {
        console.error('Error generating ledger:', error);
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: "Error generating ledger" });
    }
};




export {
    getSalesReport,
    exportSalesReport,
    getSalesData,
    generateLedger
}