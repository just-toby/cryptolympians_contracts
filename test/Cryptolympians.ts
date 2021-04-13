import * as chai from 'chai';
import { Cryptolympians } from '../typechain/Cryptolympians';
import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { Wallet } from 'ethers';
import { ethers, waffle } from "hardhat";

const { expect } = chai;

describe("Cryptolympians", () => {

    let cryptolympians: Cryptolympians;
    let signers: SignerWithAddress[];
    const provider = waffle.provider;

    beforeEach(async () => {
        signers = await ethers.getSigners();
        const cryptolympiansContractFactory = await ethers.getContractFactory(
            "Cryptolympians",
            signers[0]
        );
        cryptolympians = (await cryptolympiansContractFactory.deploy()) as Cryptolympians;
        expect(cryptolympians.address).to.properAddress;
    });

    describe("initialization", async () => {
        // TODO: Test that it is created with correct defaults.
    });

    describe("owner-only functions", async () => {
        // TODO: Test that the owner-only functions can only be called by the deployer.
        // TODO: test that the owner can set a new minimum bid amount
        // TODO: Test that the owner can set a new reserve price.
    });

    describe("mint tokens", async () => {
        // TODO: Test that minting new NFTs works correctly
        // TODO: verify only the owner can mint new NFTs
        // TODO: verify the metadata URL is correct
        // TODO: verify the new NFT's id is correct
    });

    describe("payable and withdrawable", async () => {
        // TODO: Test that you can send ETH to the contract
        // TODO: test that only the owner can withdraw all the ETH from the contract
        // TODO: Test that the owner can't withdraw while an auction is live
    });

    describe("create a new auction", async () => {
        // TODO: Test that the owner can create a new auction
        // TODO: test that non-owners can't create new auctions
        // TODO: Test that the new auction is correctly saved to storage
        // TODO: Test that you can't create an auction for a non-existent token.
    });

    describe("place a bid", async () => {
        // TODO: test that anyone can place a bid on a live auction.
        // TODO: Test that bids fail for auctions that ended or haven't started.
        // TODO: test that bids fail if not > winningBid + minBid
        // TODO: test that a successful bid results in refunded funds to the previous winner.
    });

    describe("claiming NFTs from a completed auction", async () => {
        // TODO: Test that only the winner can claim
        // TODO: Test that transfers are successful from the contract to the winner.
    });
});