// filepath: /sales-report-generator/sales-report-generator/src/utils/dateFilter.js
const createDateFilter = (filter, startDate, endDate) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let dateFilter = {};

    switch (filter.toLowerCase()) {
        case 'daily':
            dateFilter = {
                createdOn: {
                    $gte: today,
                    $lte: new Date(now.setHours(23, 59, 59, 999))
                }
            };
            break;

        case 'weekly':
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() - 6);
            dateFilter = {
                createdOn: {
                    $gte: weekStart,
                    $lte: new Date(now.setHours(23, 59, 59, 999))
                }
            };
            break;

        case 'monthly':
            const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
            dateFilter = {
                createdOn: {
                    $gte: monthStart,
                    $lte: new Date(now.setHours(23, 59, 59, 999))
                }
            };
            break;

        case 'yearly':
            const yearStart = new Date(today.getFullYear(), 0, 1);
            dateFilter = {
                createdOn: {
                    $gte: yearStart,
                    $lte: new Date(now.setHours(23, 59, 59, 999))
                }
            };
            break;

        case 'custom':
            if (startDate && endDate) {
                const customStart = new Date(startDate);
                const customEnd = new Date(endDate);
                dateFilter = {
                    createdOn: {
                        $gte: customStart,
                        $lte: new Date(customEnd.setHours(23, 59, 59, 999))
                    }
                };
            }
            break;

        default:
            dateFilter = {
                createdOn: {
                    $gte: today,
                    $lte: new Date(now.setHours(23, 59, 59, 999))
                }
            };
    }

    return dateFilter;
};

export default createDateFilter;