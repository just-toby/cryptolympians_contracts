// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract Cryptolympians is ERC721, Ownable, IERC721Receiver {
    using Counters for Counters.Counter;

    struct Auction {
        uint256 tokenID;
        address payable winner;
        uint256 winningBid; // wei
        uint256 startTime;
        uint256 endTime;
    }

    // Use this for safely minting new NFTs. Starts at 0.
    Counters.Counter public tokenIds;
    // Use this to track the most recent auction.
    Counters.Counter public auctionCount;
    Auction[] public auctions;
    // min amount to increase winner by (in WEI)
    uint256 public minBid;
    // Auctions won't suceed if the reserve price isn't met.
    // In that case, the funds will be returned to the highest bidder
    // and the NFT will remain with this contract.
    uint256 public reservePrice;

    constructor() ERC721("Cryptolympians", "OLYMP") {}

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return
            bytes4(
                keccak256("onERC721Received(address,address,uint256,bytes)")
            );
    }

    // Fallback function to make this contract payable.
    receive() external payable {}

    /**
     * @dev Base URI for computing {tokenURI}.
     */
    function _baseURI() internal pure override returns (string memory) {
        return "https://www.cryptolympians.com/api/token?id=";
    }

    function setMinBid(uint256 newMinBid) external onlyOwner() {
        minBid = newMinBid;
    }

    function setReservePrice(uint256 newReservePrice) external onlyOwner() {
        reservePrice = newReservePrice;
    }

    function withdraw() external onlyOwner() {
        Auction storage current = auctions[auctionCount.current() - 1];
        require(block.timestamp > current.endTime);
        (bool sent, bytes memory data) =
            owner().call{value: address(this).balance}("");
    }

    function mintNft() external onlyOwner() returns (uint256) {
        uint256 newNftTokenId = tokenIds.current();
        _safeMint(address(this), newNftTokenId);

        tokenIds.increment();

        return newNftTokenId;
    }

    function createAuction(
        uint256 tokenId,
        uint256 startTime, // unix timestamp
        uint256 durationHours
    ) public onlyOwner() {
        require(
            auctionCount.current() == 0 ||
                auctions[auctionCount.current()].endTime < startTime
        );
        require(_exists(tokenId));
        auctions.push(
            Auction(
                tokenId,
                payable(this),
                0,
                startTime,
                startTime + durationHours * 1 hours
            )
        );
        auctionCount.increment();
    }

    function placeBid(uint256 auctionIndex) external payable {
        Auction storage current = auctions[auctionIndex];

        require(
            block.timestamp >= current.startTime,
            "Bid during an invalid time period."
        );
        require(
            block.timestamp < current.endTime,
            "Bid during an invalid time period."
        );
        require(
            msg.value > current.winningBid + minBid,
            "Bid not high enough."
        );

        (bool sent, bytes memory data) =
            current.winner.call{value: current.winningBid}("");
        // NOTE: we don't require that this succeed to avoid someone gaming the auction
        // with 2 addresses they control. In case the first could reject the funds from being returned
        // and prevent any higher bids from coming in.

        current.winner = payable(msg.sender);
        current.winningBid = msg.value;
    }

    function claim(uint256 auctionIndex) external {
        Auction storage auction = auctions[auctionIndex];
        require(auction.winner == msg.sender);
        require(auction.endTime < block.timestamp);
        safeTransferFrom(address(this), msg.sender, auction.tokenID);
    }
}