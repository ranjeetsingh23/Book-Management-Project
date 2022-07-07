// const { default: mongoose } = require("mongoose")
const bookModel = require("../models/bookModel")
const userModel = require("../models/userModel")
const validator = require('../validator/validator')
const reviewModel = require("../models/reviewModel")
const moment = require('moment')

exports.createBook = async (req, res) => {

    try {

        let data = req.body;
        let userloged = req.decodedToken //decodedToken is present in request that we have set in authorization middleware it contains loggedIn UserId
        let { title, excerpt, userId, ISBN, category, subcategory, releasedAt } = data

        if (Object.keys(data).length == 0)
            return res.status(400).send({ status: false, message: "you have to enter all details" })

        if (!validator.isValid(title)) {
            return res.status(400).send({ status: false, message: "title required" })
        }
        if (!validator.isValid(excerpt)) {
            return res.status(400).send({ status: false, message: "excerpt required" })
        } if (!userId) {
            return res.status(400).send({ status: false, message: "UserId required" })
        }
        if (!validator.isValidObjectId(userId)) {
            return res.status(403).send({ status: false, message: "provide valid userId" })
        }
        if (!validator.isValid(category)) {
            return res.status(400).send({ status: false, message: "category required" })
        }
        if (!validator.isValid(ISBN)) {
            return res.status(400).send({ status: false, message: "ISBN required" })
        }
        if (!/^(\d{13})?$/.test(ISBN)) {
            return res.status(400).send({ status: false, message: "Please enter a valid ISBN number" })
        }
        if (!validator.isValid(subcategory)) {
            return res.status(400).send({ status: false, message: "subcategory required" })
        }
        if (!validator.isValid(releasedAt)) {
            return res.status(400).send({ status: false, message: "releasedAt required" })
        }

        if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/.test(releasedAt)) { return res.status(400).send({ status: false, msg: "Please enter date in YYYY-MM-DD" }) }
        //    data.releasedAt = moment().format("YYYY-MM-DD,hh:mm:ss")
        //    if(!data.releasedAt) return res.status(400).send("please send date in correct")

        const checkUserId = await userModel.findOne({ userId: userId })
        if (!checkUserId) { return res.status(400).send({ status: false, message: "UserId not found" }) }

        const checktitle = await bookModel.findOne({ title: title })
        if (checktitle) { return res.status(400).send({ status: false, message: "title already exists please enter new title" }) }

        const checkIsbn = await bookModel.findOne({ ISBN: ISBN })
        if (checkIsbn) { return res.status(400).send({ status: false, message: "ISBN already exists please enter new ISBN" }) }

        if (userId != userloged) { //In this block verifying BlogId belongs to same user or not
            return res.status(403).send({ status: false, data: "Not authorized" })
        }
        const saveBook = await bookModel.create(req.body)
        return res.status(201).send({ status: true, message: "Book successfully created", data: saveBook })
    }
    catch (error) {
        return res.status(500).send({ status: false, message: error.message })
    }


}


exports.getBooks = async (req, res) => {

    try {
        let query = req.query;  //getting data from query params

        if (Object.keys(query).length == 0) {
            return res.status(400).send({ status: false, message: "Please provide filter in query params" })

        }

        let filter = {
            isDeleted: false
        };
        if (Object.keys(query).length !== 0) { //this block will work in case filter is provided

            if (query.subcategory) {
                query.subcategory = { $in: query.subcategory.split(",") };
            }
            filter['$or'] = [
                { userId: query.userId },
                { category: query.category },
                { subcategory: query.subcategory }
            ];
        }

        let filterByquery = await bookModel.find(filter) //finding book from database 
        return res.status(200).send({ message: filterByquery });
    } catch (err) {
        return res.status(500).send({ status: false, error: err.message });
    }
}




exports.getBooksById = async function (req, res) {

    try {
        let bookId = req.params.bookId;
        if (!validator.isValidObjectId(bookId)) return res.status(400).send({ status: false, message: "Please provide valid bookId" });


        const book = await bookModel.findOne({ _id: bookId }).select({ __v: 0 })
        if (!book) { return res.status(404).send({ status: false, message: "book not found" }) }

        if (book.isDeleted == true) return res.status(404).send({ status: false, message: "Book is deleted or not found" })

        let reviews = await reviewModel.find({ bookId: book._id, isDeleted: false }).select({ isDeleted: 0, __v: 0, createdAt: 0, updatedAt: 0 })

        let booksWithReview = book.toObject();
        Object.assign(booksWithReview, { reviewsData: reviews });
        return res.status(200).send({ status: true, message: "Books List", data: booksWithReview })


    } catch (error) {
        return res.status(500).send({ status: false, error: error.message })
    }
}


exports.updateBooksById = async (req, res) => {
    try {

        let bookId = req.params.bookId
        const { title, excerpt, releasedAt, ISBN } = req.body

        if (!validator.isValidObjectId(bookId)) return res.status(400).send({ status: false, message: "Please provide valid bookId" });

        if (Object.keys(req.body).length == 0) return res.status(400).send({ status: false, message: "Please enter data in  body" });


        let book = await bookModel.findById(bookId)
        if (!book || book.isDeleted == true) { return res.status(404).send({ status: false, message: "book not found" }) }

        // if (!/^(\d{13})?$/.test(ISBN)) {
        //     return res.status(400).send({ status: false, message: "Please enter a valid ISBN number" })
        // }
        if (!validator.isValid(title)) {
            return res.status(400).send({ status: false, message: "Enter title in correct format" })
        }

        const dublicateTitle = await bookModel.findOne({ title: title })

        if (dublicateTitle) {
            return res.status(400).send({ status: false, message: `${title} is already exists please enter new title` })
        }

        const dublicateISBN = await bookModel.findOne({ ISBN: ISBN })
        if (dublicateISBN) {
            return res.status(400).send({ status: false, message: `ISBN already exists please enter new ISBN` })
        }

        if (releasedAt) {
            if (!validator.isValid(releasedAt)) {
                return res.status(400).send({ status: false, message: "releasedAt is required" })
            };
            if (!validator.isValidDate(releasedAt)) {
                return res.status(400).send({ status: false, message: "releasedAt is in incorrect format (YYYY-MM-DD)" })
            }
        }

        // if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/.test(releasedAt)) { return res.status(400).send({ status: false, msg: "Please enter date in YYYY-MM-DD" }) }

        const updateBook = await bookModel.findOneAndUpdate({ _id: bookId }, { title: title, excerpt: excerpt, releasedAt: releasedAt, $set: { ISBN: ISBN } }, { new: true })
        { return res.status(200).send({ status: true, message: "Updated Succesfully", data: updateBook }) }


    } catch (error) {
        return res.status(500).send({ status: false, error: error.message });
    }

}

exports.deleteBookById = async (req, res) => {

    try {

        let id = req.params.bookId;
        let userloged = req.decodedToken //decodedToken is present in request that we have set in auth middleware it contains loggedIn UserrId
        if (!validator.isValidObjectId(id)) {
            return res.status(400).send({ status: false, messageg: 'BookId is invalid.' });
        }

        if (id) {
            let findbook = await bookModel.findById(id)
            if (!findbook) return res.status(404).send({ status: false, messageg: `no book found by this BookID:${id}` });

            if (findbook.userId != userloged) {
                return res.status(403).send({ status: false, data: "Not authorized" })
            }

            if (findbook.isDeleted == false) {
                let Update = await bookModel.findOneAndUpdate(
                    { _id: id },
                    {
                        isDeleted: true, deletedAt: new Date()
                    });
                return res.status(200).send({ status: true, message: "Your data deleted successfully" });

            } else {
                return res.status(404).send({ status: false, message: "Book already deleted" });
            }
        }
    } catch (err) {
        res.status(500).send({ status: false, error: err.message });
    }
}


