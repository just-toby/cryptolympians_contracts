import * as chai from 'chai';
import { Cryptolympians } from '../typechain/Cryptolympians';
import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { BigNumber, ContractTransaction, Wallet } from 'ethers';
import { ethers, waffle, network } from "hardhat";

const { expect } = chai;

describe("Cryptolympians", () => {

    let cryptolympians: Cryptolympians;
    let signers: SignerWithAddress[];
    const provider = waffle.provider;
    let blockTimestamp = 1623571400;

    beforeEach(async () => {
        signers = await ethers.getSigners();
        const cryptolympiansContractFactory = await ethers.getContractFactory(
            "Cryptolympians",
            signers[0]
        );
        cryptolympians = (await cryptolympiansContractFactory.deploy()) as Cryptolympians;
        expect(cryptolympians.address).to.properAddress;
    });

    afterEach(async () => {
        blockTimestamp += 8 * 24 * 60 * 60;
    });

    describe("initialization", async () => {
        it("should default minBid and reservePrice to 0", async () => {
            const minBid = await cryptolympians.minBid();
            expect(minBid).to.equal(0);

            const reservePrice = await cryptolympians.reservePrice();
            expect(reservePrice).to.equal(0);

            const tokenId = await cryptolympians.nextTokenId()
            expect(tokenId).to.equal(0);
        });

        it("should have no auctionCount = 0", async () => {
            const auctionCount = await cryptolympians.auctionCount();
            expect(auctionCount).to.equal(0);
        });

        it("should revert on trying to get an invalid auction", async () => {
            await expect(cryptolympians.auctions(0)).to.be.reverted;
        });
    });

    describe("owner-only functions", async () => {
        it('should only allow owner to set min bid', async () => {
            await cryptolympians.connect(signers[0]).setMinBid(100000);

            await expect(cryptolympians.connect(signers[1]).setMinBid(10000)).to.be.reverted;
        });
        
        it('should only allow owner to set reserve price', async () => {
            await cryptolympians.connect(signers[0]).setReservePrice(100000);

            await expect(cryptolympians.connect(signers[1]).setReservePrice(10000)).to.be.reverted;
        });      
    });

    describe("minting + ERC721 behavior", async () => {
        it('should succeed minting and increment the ID counter', async () => {
            let nextTokenId;
            nextTokenId = await cryptolympians.nextTokenId();
            expect(nextTokenId).to.equal(0);

            // TODO: use the return value of this funtion to check the result
            await cryptolympians.mintNft();
            nextTokenId = await cryptolympians.nextTokenId();
            expect(nextTokenId.toNumber() - 1).to.equal(0);

            nextTokenId = await cryptolympians.nextTokenId();
            expect(nextTokenId).to.equal(1);
        });

        it('should give newly minted tokens to the contract', async () => {
            // TODO: use the return value of this funtion to check the result
            await cryptolympians.mintNft();
            const nextTokenId = await cryptolympians.nextTokenId();

            const newTokenOwner = await cryptolympians.ownerOf(nextTokenId.toNumber() - 1);
            expect(newTokenOwner).to.be.equal(cryptolympians.address);
        });

        it('should only allow the owner to mint new tokens', async () => {
            await cryptolympians.connect(signers[0]).mintNft();

            await expect(cryptolympians.connect(signers[1]).mintNft()).to.be.reverted;
        });

        it('should have the correct metadata for token 0', async () => {
            // TODO: use the return value of this funtion to check the result
            await cryptolympians.mintNft();
            const nextTokenId = await cryptolympians.nextTokenId();
            const latestTokenMetadata = await cryptolympians.tokenURI(nextTokenId.toNumber() - 1);

            expect(latestTokenMetadata).to.be.equal('https://www.cryptolympians.com/api/token?id=0');
        });
    });

    describe("create a new auction", async () => {
        it('allows the owner to create a new auction', async () => {
            await network.provider.send("evm_setNextBlockTimestamp", [blockTimestamp])
            await cryptolympians.connect(signers[0]).mintNft();
                        
            await cryptolympians.connect(signers[0]).createAuction(
                    0, 
                    blockTimestamp + 60 /* start time in unix time (60 seconds after minting) */, 
                    24 * 7 /* duration in hours */);
        });

        it('doesn\'t allow non-owners to create new auctions', async () => {
            await network.provider.send("evm_setNextBlockTimestamp", [blockTimestamp])
            await cryptolympians.connect(signers[0]).mintNft();
            
            await expect(cryptolympians.connect(signers[1]).createAuction(
                    0, 
                    blockTimestamp + 60 /* start time in unix time (60 seconds after minting) */, 
                    24 * 7 /* duration in hours */)).to.be.reverted;

        });

        it('should successfully store the new auction details', async () => {
            await network.provider.send("evm_setNextBlockTimestamp", [blockTimestamp])
            await cryptolympians.connect(signers[0]).mintNft();
            
            // TODO: use the return value of this funtion to check the result
            await cryptolympians.connect(signers[0]).createAuction(
                    0, 
                    blockTimestamp + 60 /* start time in unix time (60 seconds after minting) */, 
                    24 * 7 /* duration in hours */);
            const auctionIndex = (await cryptolympians.auctionCount()).toNumber() - 1;

            const currentAuction = await cryptolympians.auctions(auctionIndex);
            expect(currentAuction.tokenID).to.equal(0);
            expect(currentAuction.winner).to.equal(cryptolympians.address);
            expect(currentAuction.winningBid).to.equal(0);
            expect(currentAuction.startTime).to.equal(blockTimestamp + 60);
            expect(currentAuction.endTime).to.equal((blockTimestamp + 60) + 24 * 7 * 60 * 60);
        });
        
        it('should not allow you to create an auction for a non-existent token.', async () => {
            await network.provider.send("evm_setNextBlockTimestamp", [blockTimestamp])

            await cryptolympians.connect(signers[0]).mintNft();
            
            await expect(cryptolympians.connect(signers[0]).createAuction(
                1, // not minted yet 
                blockTimestamp + 60 /* start time in unix time (60 seconds after minting) */, 
                24 * 7 /* duration in hours */)).to.be.reverted;
        });
    });

    describe("payable and withdrawable", async () => {
        it('should only allow owner to withdraw', async () => {
            await cryptolympians.connect(signers[0]).withdraw();

            await expect(cryptolympians.connect(signers[1]).withdraw()).to.be.reverted;
        });  
        
        it('should not allow owner to withdraw while an auction is live', async () => {
            await network.provider.send("evm_setNextBlockTimestamp", [blockTimestamp])

            await cryptolympians.connect(signers[0]).mintNft();

            await cryptolympians.connect(signers[0]).createAuction(
                    0, 
                    blockTimestamp + 60 /* start time in unix time (60 seconds after minting) */, 
                    24 * 7 /* duration in hours */);

            await network.provider.send("evm_setNextBlockTimestamp", [blockTimestamp + 60 + 1])

            await expect(cryptolympians.connect(signers[0]).withdraw()).to.be.reverted;
        });
    });

    describe("place a bid", async () => {
        it('should allow anyone to place bids on a live auction', async () => {
            await network.provider.send("evm_setNextBlockTimestamp", [blockTimestamp])

            await cryptolympians.connect(signers[0]).mintNft();

            // TODO: use the return value of this funtion to check the result
            await cryptolympians.connect(signers[0]).createAuction(
                0, 
                blockTimestamp + 60 /* start time in unix time (60 seconds after minting) */, 
                24 * 7 /* duration in hours */);

            const auctionIndex = (await cryptolympians.auctionCount()).toNumber() - 1;

            await network.provider.send("evm_setNextBlockTimestamp", [blockTimestamp + 60 + 1])
            await cryptolympians.connect(signers[1]).placeBid(auctionIndex, {
                value: 1000000
            });
            await cryptolympians.connect(signers[0]).placeBid(auctionIndex, {
                value: 2000000
            });
            await cryptolympians.connect(signers[2]).placeBid(auctionIndex, {
                value: 3000000
            });
        });

        it('should should not allow bids on auctions that haven\'t started', async () => {
            await network.provider.send("evm_setNextBlockTimestamp", [blockTimestamp])

            await cryptolympians.connect(signers[0]).mintNft();

            // TODO: use the return value of this funtion to check the result
            await cryptolympians.connect(signers[0]).createAuction(
                0, 
                blockTimestamp + 60 /* start time in unix time (60 seconds after minting) */, 
                24 * 7 /* duration in hours */);

            const auctionIndex = (await cryptolympians.auctionCount()).toNumber() - 1;

            await network.provider.send("evm_setNextBlockTimestamp", [blockTimestamp + 59])
            await expect(cryptolympians.connect(signers[1]).placeBid(auctionIndex, {
                value: 1000000
            })).to.be.reverted;
        });

        it('should should not allow bids on auctions that ended', async () => {
            await network.provider.send("evm_setNextBlockTimestamp", [blockTimestamp])

            await cryptolympians.connect(signers[0]).mintNft();

            // TODO: use the return value of this funtion to check the result
            await cryptolympians.connect(signers[0]).createAuction(
                0, 
                blockTimestamp + 60 /* start time in unix time (60 seconds after minting) */, 
                24 * 7 /* duration in hours */);

            const auctionIndex = (await cryptolympians.auctionCount()).toNumber() - 1;

            await network.provider.send("evm_setNextBlockTimestamp", [blockTimestamp + 60 + (24 * 7 * 60 * 60) + 1]);
            await expect(cryptolympians.connect(signers[1]).placeBid(auctionIndex, {
                value: 1000000
            })).to.be.reverted;
        });

        it('should fail bids that are not higher than the winning bid', async () => {
            await network.provider.send("evm_setNextBlockTimestamp", [blockTimestamp])

            await cryptolympians.connect(signers[0]).mintNft();

            // TODO: use the return value of this funtion to check the result
            await cryptolympians.connect(signers[0]).createAuction(
                0, 
                blockTimestamp + 60 /* start time in unix time (60 seconds after minting) */, 
                24 * 7 /* duration in hours */);

            const auctionIndex = (await cryptolympians.auctionCount()).toNumber() - 1;

            await network.provider.send("evm_setNextBlockTimestamp", [blockTimestamp + 60 + 1])
            await cryptolympians.connect(signers[1]).placeBid(auctionIndex, {
                value: 1000000
            });
            await expect(cryptolympians.connect(signers[0]).placeBid(auctionIndex, {
                value: 1000000
            })).to.be.reverted;
            await cryptolympians.connect(signers[2]).placeBid(auctionIndex, {
                value: 3000000
            });
        });

        it('should refund previous winning bid', async () => {
            await network.provider.send("evm_setNextBlockTimestamp", [blockTimestamp])

            await cryptolympians.connect(signers[0]).mintNft();

            // TODO: use the return value of this funtion to check the result
            await cryptolympians.connect(signers[0]).createAuction(
                0, 
                blockTimestamp + 60 /* start time in unix time (60 seconds after minting) */, 
                24 * 7 /* duration in hours */);

            const auctionIndex = (await cryptolympians.auctionCount()).toNumber() - 1;

            await network.provider.send("evm_setNextBlockTimestamp", [blockTimestamp + 60 + 1])
            await cryptolympians.connect(signers[1]).placeBid(auctionIndex, {
                value: 1000000
            });
            await cryptolympians.connect(signers[2]).placeBid(auctionIndex, {
                value: 3000000
            });

            const contractBalanceWei = await ethers.provider.getBalance(cryptolympians.address);

            expect(contractBalanceWei).to.equal(3000000);
        });
        
        
        it('should emit a Bid event for a new winning bid', async () => {
            await network.provider.send("evm_setNextBlockTimestamp", [blockTimestamp])

            await cryptolympians.connect(signers[0]).mintNft();

            // TODO: use the return value of this funtion to check the result
            await cryptolympians.connect(signers[0]).createAuction(
                0, 
                blockTimestamp + 60 /* start time in unix time (60 seconds after minting) */, 
                24 * 7 /* duration in hours */);

            const auctionIndex = (await cryptolympians.auctionCount()).toNumber() - 1;

            await network.provider.send("evm_setNextBlockTimestamp", [blockTimestamp + 60 + 1])
            await expect(cryptolympians.connect(signers[1]).placeBid(auctionIndex, {
                value: 1000000
            })).to.emit(cryptolympians, "Bid").withArgs(signers[1].address, 1000000);
            await expect(cryptolympians.connect(signers[2]).placeBid(auctionIndex, {
                value: 3000000
            })).to.emit(cryptolympians, "Bid").withArgs(signers[2].address, 3000000);


        });
    });

    describe("claiming NFTs from a completed auction", async () => {
        it('should not allow loser to claim', async () => {
            await network.provider.send("evm_setNextBlockTimestamp", [blockTimestamp])

            await cryptolympians.connect(signers[0]).mintNft();

            // TODO: use the return value of this funtion to check the result
            await cryptolympians.connect(signers[0]).createAuction(
                0, 
                blockTimestamp + 60 /* start time in unix time (60 seconds after minting) */, 
                24 * 7 /* duration in hours */);

            const auctionIndex = (await cryptolympians.auctionCount()).toNumber() - 1;

            await network.provider.send("evm_setNextBlockTimestamp", [blockTimestamp + 60 + 1])
            await cryptolympians.connect(signers[1]).placeBid(auctionIndex, {
                value: 1000000
            });

            const auctionEndTimestamp = blockTimestamp + 60 + (24 * 7 * 60 * 60);
            await network.provider.send(
                "evm_setNextBlockTimestamp", 
                [auctionEndTimestamp + 1]
            );

            await expect(cryptolympians.connect(signers[2]).claim(auctionIndex)).to.be.reverted;
        });

        it('should allow winner to claim after auction ends', async () => {
            await network.provider.send("evm_setNextBlockTimestamp", [blockTimestamp])
            await cryptolympians.connect(signers[0]).mintNft();
            
            // TODO: use the return value of this funtion to check the result
            await cryptolympians.connect(signers[0]).createAuction(
                0, 
                blockTimestamp + 60 /* start time in unix time */, 
                24 * 7 /* duration in hours */);

            const auctionIndex = (await cryptolympians.auctionCount()).toNumber() - 1;

            await network.provider.send("evm_setNextBlockTimestamp", [blockTimestamp + 60 + 1])
            await cryptolympians.connect(signers[1]).placeBid(auctionIndex, {
                value: 1000000
            });

            const auctionEndTimestamp = blockTimestamp + 60 + (24 * 7 * 60 * 60);
            await network.provider.send(
                "evm_setNextBlockTimestamp", 
                [auctionEndTimestamp + 1]
            );

            await cryptolympians.connect(signers[1]).claim(auctionIndex);

            const newOwner = await cryptolympians.ownerOf(0);
            expect(newOwner).to.equal(signers[1].address);
        });
    });

    describe('e2e flow and post-auction tests', async () => {
        it('prevent owner from creating an auction for a token that ' +
           'the contract no longer owns', async () => {
            await network.provider.send("evm_setNextBlockTimestamp", [blockTimestamp])
            await cryptolympians.connect(signers[0]).mintNft();

            // TODO: use the return value of this funtion to check the result
            await cryptolympians.connect(signers[0]).createAuction(
                0, 
                blockTimestamp + 60 /* start time in unix time (60 seconds after minting) */, 
                24 * 7 /* duration in hours */);

            const auctionIndex = (await cryptolympians.auctionCount()).toNumber() - 1;

            await network.provider.send("evm_setNextBlockTimestamp", [blockTimestamp + 60 + 1])
            await cryptolympians.connect(signers[1]).placeBid(auctionIndex, {
                value: 1000000
            });

            const auctionEndTimestamp = blockTimestamp + 60 + (24 * 7 * 60 * 60);
            await network.provider.send(
                "evm_setNextBlockTimestamp", 
                [auctionEndTimestamp + 1]
            );

            await cryptolympians.connect(signers[1]).claim(auctionIndex);
            
            await expect(cryptolympians.connect(signers[0]).createAuction(
                    0, 
                    auctionEndTimestamp + 60,
                    24 * 7 /* duration in hours */)).to.be.reverted;

        });

        it('should allow owner to withdraw ETH after an auction', async () => {
            await network.provider.send("evm_setNextBlockTimestamp", [blockTimestamp])
            await cryptolympians.connect(signers[0]).mintNft();
    
            // TODO: use the return value of this funtion to check the result
            await cryptolympians.connect(signers[0]).createAuction(
                0, 
                blockTimestamp + 60 /* start time in unix time (60 seconds after minting) */, 
                24 * 7 /* duration in hours */);
    
            const auctionIndex = (await cryptolympians.auctionCount()).toNumber() - 1;
    
            await network.provider.send("evm_setNextBlockTimestamp", [blockTimestamp + 60 + 1])
            await cryptolympians.connect(signers[1]).placeBid(auctionIndex, {
                value: 1000000
            });
    
            const auctionEndTimestamp = blockTimestamp + 60 + (24 * 7 * 60 * 60);
            await network.provider.send(
                "evm_setNextBlockTimestamp", 
                [auctionEndTimestamp + 1]
            );

            await cryptolympians.connect(signers[1]).claim(auctionIndex);

            const ownerStartingBalance: BigNumber = await ethers.provider.getBalance(signers[0].address);
    
            const withdrawTx = await cryptolympians.connect(signers[0]).withdraw();
            const withdrawTxReceipt = await withdrawTx.wait();
            const gasPaid = withdrawTxReceipt.gasUsed.mul(withdrawTx.gasPrice);


            const ownerNewBalance: BigNumber = await ethers.provider.getBalance(signers[0].address);

            expect(ownerNewBalance.add(gasPaid).sub(ownerStartingBalance).toNumber()).to.equal(1000000);
        });
    });
});
